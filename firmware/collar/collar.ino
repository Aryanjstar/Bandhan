/*
  Pawse collar firmware — ESP32 + one MPU6050 + buzzer + demo button.

  Hardware note (2026-09-27): the collar carries a single MPU6050, not the
  dual-IMU layout the original PRD assumed — PRD.md/SYSTEM_DESIGN.md are
  updated to match. There's no second unit to fall back to, so a failed sensor
  read is a hard skip for that tick, not a "degraded but continuing" state.

  On-device motion classification (PRD FR-1.2) so the buzzer never depends on
  WiFi (PRD §5 rule 4) — classification and the local beep happen in loop()
  before anything is sent over the network. Thresholds here MUST stay in sync
  with backend/fusion-service/src/lib/motionClassifier.js (used by the Node
  device simulator for testing this same logic without hardware) — see that
  file's header comment for where the numbers come from and why they're
  engineering defaults, not exact dataset-measured cutoffs.

  Telemetry is posted to the local-only collar path documented in
  backend/README.md ("Collar (ESP32) sensor ingestion — local-only, no IoT
  Hub yet") — POST http://<mac LAN ip>:7071/api/sensor-data. Moving to the
  real WiFi/MQTT -> IoT Hub uplink (SYSTEM_DESIGN.md §5) is a transport swap
  once a device identity is provisioned, not a rewrite of this file's sensing
  or classification logic.

  Demo button (PRD §8 "manual mark this as an event" button): press it to
  force an immediate distress alert end to end, without waiting for a real
  seizure-like motion — useful for demoing the alert pipeline on a bench.

  Cue playback (single beep = "sit", continuous beep = "handshake", PRD §11):
  BEEP_PATTERNS below is the on-device half of that vocabulary.

  Wellness check-in (owner-initiated "is my dog actually okay right now?"):
  since there's no persistent local push channel yet, the collar polls
  GET /api/devices/{deviceId}/pending-command every few seconds. A pending
  "check_in" command plays a short double-beep (distinct from the sit/
  handshake cues) to get the dog's attention, then switches telemetry to a
  short high-rate burst so the owner's dashboard gets a dense live read of
  motion — enough to tell "just resting" from "not responding, not moving."
*/

#include <Wire.h>
#include <WiFi.h>
#include <HTTPClient.h>

// ---- Fill in for your network / pilot dog before flashing ----
const char *WIFI_SSID = "YOUR_WIFI_SSID";
const char *WIFI_PASSWORD = "YOUR_WIFI_PASSWORD";
const char *SERVER_HOST = "http://192.168.1.100:7071"; // api-service LAN address (ipconfig getifaddr en0)
const char *DOG_ID = "test-dog";
const char *DEVICE_ID = "collar-cupid-001";

// ---- Pins ----
const int PIN_BUZZER = 25;
const int PIN_LED = LED_BUILTIN; // green/red status LED (PRD §8)
const int PIN_DEMO_BUTTON = 27;  // INPUT_PULLUP; press = force a distress alert
const int MPU_ADDR = 0x68;       // single MPU6050, AD0 pulled low

// ---- Motion classifier thresholds ----
// Keep numbers identical to motionClassifier.js's header comment.
const float REST_ENERGY_G = 0.15;
const float PACING_ENERGY_G = 0.5;
const unsigned long PACING_MIN_DURATION_MS = 20000;
const float JERK_SPIKE_G = 2.5;
const unsigned long JERK_SPIKE_WINDOW_MS = 1500;
const int JERK_SPIKES_FOR_DISTRESS = 3;

const unsigned long SAMPLE_INTERVAL_MS = 50;        // 20 Hz on-device classification
const unsigned long POST_INTERVAL_MS = 1000;        // duty-cycled uplink (PRD §15 battery target)
const unsigned long CHECKIN_POST_INTERVAL_MS = 250; // dense "live stream" rate during a wellness check-in
const unsigned long CHECKIN_BURST_MS = 10000;        // how long the dense rate lasts after a check-in beep
const unsigned long PENDING_COMMAND_POLL_MS = 3000;  // how often to ask the server for a queued check-in/cue
const unsigned long SPIKE_HISTORY_MAX = 8;

float lastMagnitude = -1;
unsigned long stillSinceMs = 0;
bool isStill = false;
unsigned long pacingSinceMs = 0;
bool isPacing = false;
unsigned long spikeTimestamps[SPIKE_HISTORY_MAX];
int spikeCount = 0;

String currentMotionClass = "normal";
float currentMotionEnergy = 0;
unsigned long currentStillDurationSec = 0;
bool mpuOk = false;

unsigned long lastSampleAt = 0;
unsigned long lastPostAt = 0;
unsigned long lastPendingPollAt = 0;
unsigned long forcedDistressUntil = 0;
unsigned long checkInBurstUntil = 0;

// Single beep = "sit", continuous beep = "handshake" (PRD §11 defaults — owner-
// configurable from the website; this map is the on-device fallback/default set).
// "check_in" is not a trainable cue (no posture match is scored for it) — it's the
// wellness-check beep, kept visually/audibly distinct as a double-beep.
struct BeepPattern {
  const char *cue;
  int beepCount;   // 0 means "continuous" (handled specially in playCue)
  int onMs;
  int offMs;
};
const BeepPattern BEEP_PATTERNS[] = {
  {"sit", 1, 200, 0},
  {"handshake", 0, 150, 100}, // continuous: on/off repeats for CONTINUOUS_DURATION_MS
  {"check_in", 2, 120, 120},
};
const unsigned long CONTINUOUS_DURATION_MS = 2000;
const unsigned long DISTRESS_BEEP_MS = 2000; // PRD FR-3.2 "long beep" for distress

bool readMpu(float *ax, float *ay, float *az) {
  Wire.beginTransmission(MPU_ADDR);
  Wire.write(0x3B); // ACCEL_XOUT_H
  if (Wire.endTransmission(false) != 0) return false;
  if (Wire.requestFrom(MPU_ADDR, 6) != 6) return false;

  int16_t rawX = (Wire.read() << 8) | Wire.read();
  int16_t rawY = (Wire.read() << 8) | Wire.read();
  int16_t rawZ = (Wire.read() << 8) | Wire.read();

  const float SENSITIVITY = 16384.0; // MPU6050 default range: +-2g
  *ax = rawX / SENSITIVITY;
  *ay = rawY / SENSITIVITY;
  *az = rawZ / SENSITIVITY;
  return true;
}

bool initMpu() {
  Wire.beginTransmission(MPU_ADDR);
  Wire.write(0x6B); // PWR_MGMT_1
  Wire.write(0x00); // wake up from sleep
  return Wire.endTransmission() == 0;
}

void classifyMotion() {
  float ax, ay, az;
  if (!mpuOk || !readMpu(&ax, &ay, &az)) return; // sensor unreadable this tick — keep last known class

  unsigned long now = millis();
  float mag = sqrt(ax * ax + ay * ay + az * az);
  float dynamicEnergy = fabs(mag - 1.0);
  float jerk = (lastMagnitude < 0) ? 0 : fabs(mag - lastMagnitude);
  lastMagnitude = mag;

  if (jerk >= JERK_SPIKE_G) {
    if (spikeCount < SPIKE_HISTORY_MAX) spikeTimestamps[spikeCount++] = now;
  }
  int kept = 0;
  for (int i = 0; i < spikeCount; i++) {
    if (now - spikeTimestamps[i] <= JERK_SPIKE_WINDOW_MS) spikeTimestamps[kept++] = spikeTimestamps[i];
  }
  spikeCount = kept;

  bool moving = dynamicEnergy >= REST_ENERGY_G;
  if (moving) { isStill = false; }
  else if (!isStill) { isStill = true; stillSinceMs = now; }

  bool pacingNow = dynamicEnergy >= PACING_ENERGY_G;
  if (pacingNow) { if (!isPacing) { isPacing = true; pacingSinceMs = now; } }
  else { isPacing = false; }

  currentStillDurationSec = isStill ? (now - stillSinceMs) / 1000 : 0;
  currentMotionEnergy = dynamicEnergy;

  if (spikeCount >= JERK_SPIKES_FOR_DISTRESS) {
    currentMotionClass = "distress";
  } else if (isPacing && (now - pacingSinceMs) >= PACING_MIN_DURATION_MS) {
    currentMotionClass = "minor_anomaly";
  } else {
    currentMotionClass = "normal";
  }
}

// The beep is the ONLY output that must never wait on the network (PRD §5 rule 4).
void buzz(unsigned long durationMs) {
  digitalWrite(PIN_BUZZER, HIGH);
  delay(durationMs);
  digitalWrite(PIN_BUZZER, LOW);
}

void playCue(const char *cueId) {
  for (auto &pattern : BEEP_PATTERNS) {
    if (strcmp(pattern.cue, cueId) != 0) continue;
    if (pattern.beepCount == 0) {
      unsigned long start = millis();
      while (millis() - start < CONTINUOUS_DURATION_MS) {
        digitalWrite(PIN_BUZZER, HIGH);
        delay(pattern.onMs);
        digitalWrite(PIN_BUZZER, LOW);
        delay(pattern.offMs);
      }
    } else {
      for (int i = 0; i < pattern.beepCount; i++) {
        buzz(pattern.onMs);
        delay(pattern.offMs);
      }
    }
    return;
  }
}

void postTelemetry(const char *motionClass, float motionEnergy, unsigned long stillDurationSec, const char *vocalClass) {
  if (WiFi.status() != WL_CONNECTED) return; // buzzer already fired locally; uplink is best-effort (PRD §5 rule 4, SYSTEM_DESIGN §9.1)

  HTTPClient http;
  http.begin(String(SERVER_HOST) + "/api/sensor-data");
  http.addHeader("Content-Type", "application/json");

  String body = String("{\"dogId\":\"") + DOG_ID + "\",\"deviceId\":\"" + DEVICE_ID +
                 "\",\"motionClass\":\"" + motionClass + "\",\"vocalClass\":\"" + vocalClass +
                 "\",\"stillDurationSec\":" + String(stillDurationSec) +
                 ",\"motionEnergy\":" + String(motionEnergy, 3) +
                 ",\"batteryPct\":" + String(80) + "}"; // TODO: real battery ADC read once the power circuit is finalized (PRD §8)

  http.POST(body);
  http.end();
}

// Wellness check-in polling: at-most-once delivery (the server clears the pending
// command as soon as it hands it back), so a dropped WiFi packet just means the
// owner's next check-in click tries again — never a duplicate beep pair.
void pollPendingCommand() {
  if (WiFi.status() != WL_CONNECTED) return;

  HTTPClient http;
  http.begin(String(SERVER_HOST) + "/api/devices/" + DEVICE_ID + "/pending-command");
  int status = http.GET();
  if (status == 200) {
    String body = http.getString();
    if (body.indexOf("\"cue\"") >= 0) {
      int start = body.indexOf(':', body.indexOf("\"cue\"")) + 2;
      int end = body.indexOf('"', start);
      String cue = body.substring(start, end);
      Serial.println("Pending command received: " + cue);
      playCue(cue.c_str());
      if (cue == "check_in") checkInBurstUntil = millis() + CHECKIN_BURST_MS;
    }
  }
  http.end();
}

void setup() {
  Serial.begin(115200);
  pinMode(PIN_BUZZER, OUTPUT);
  pinMode(PIN_LED, OUTPUT);
  pinMode(PIN_DEMO_BUTTON, INPUT_PULLUP);

  Wire.begin();
  mpuOk = initMpu();
  if (!mpuOk) Serial.println("MPU6050 init failed — no motion classification until it recovers");

  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  Serial.print("Connecting to WiFi");
  unsigned long wifiStart = millis();
  while (WiFi.status() != WL_CONNECTED && millis() - wifiStart < 15000) {
    delay(300);
    Serial.print(".");
  }
  Serial.println(WiFi.status() == WL_CONNECTED ? " connected" : " not connected — buzzer still works offline (PRD §5 rule 4)");
}

void loop() {
  unsigned long now = millis();

  if (now - lastSampleAt >= SAMPLE_INTERVAL_MS) {
    lastSampleAt = now;
    classifyMotion();

    if (digitalRead(PIN_DEMO_BUTTON) == LOW) { // active-low, INPUT_PULLUP
      forcedDistressUntil = now + 3000; // debounce-ish: hold the forced state briefly so one press reliably posts once
      Serial.println("Demo button pressed — forcing a distress alert");
    }

    bool forced = now < forcedDistressUntil;
    const char *effectiveClass = forced ? "distress" : currentMotionClass.c_str();
    digitalWrite(PIN_LED, strcmp(effectiveClass, "normal") == 0 ? LOW : HIGH);

    if (strcmp(effectiveClass, "distress") == 0) {
      buzz(DISTRESS_BEEP_MS); // long beep, fires with zero network dependency
    } else if (strcmp(effectiveClass, "minor_anomaly") == 0) {
      buzz(150); // short beep, logged-only tier
    }

    bool inCheckInBurst = now < checkInBurstUntil;
    unsigned long postInterval = inCheckInBurst ? CHECKIN_POST_INTERVAL_MS : POST_INTERVAL_MS;
    if (now - lastPostAt >= postInterval) {
      lastPostAt = now;
      postTelemetry(effectiveClass, forced ? 3.0 : currentMotionEnergy, currentStillDurationSec, "silence");
    }
  }

  if (now - lastPendingPollAt >= PENDING_COMMAND_POLL_MS) {
    lastPendingPollAt = now;
    pollPendingCommand();
  }
}
