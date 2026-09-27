function json(status, body) {
  return { status, jsonBody: body, headers: { "content-type": "application/json" } };
}

function errorResponse(err, context) {
  const status = err.statusCode || 500;
  if (status === 500) context?.error(err);
  return json(status, { error: err.message || "internal error" });
}

module.exports = { json, errorResponse };
