# ============================================================
# Bridge — the ONE way Game Mode talks to the builder engine
# ============================================================
# The launcher passes WORKSHOP_TOKEN + WORKSHOP_PORT (the same
# session token the builder window uses) when it spawns Game
# Mode. Every call is loopback HTTP to the EXISTING admin-gated
# APIs — Game Mode has no private shortcuts and can do nothing
# the normal editor couldn't.
#
# No token / no server → MOCK MODE: every station still works
# with pretend data, clearly labeled, so the fun layer can be
# explored (and developed) without the engine running.
extends Node

var token: String = ""
var port: String = "4799"
var mock: bool = false

func _ready() -> void:
	token = OS.get_environment("WORKSHOP_TOKEN")
	var p := OS.get_environment("WORKSHOP_PORT")
	if p != "":
		port = p
	mock = token == ""

func base_url() -> String:
	return "http://127.0.0.1:%s" % port

# Fire a JSON request against the builder API. callback(status:int, body:Dictionary)
func call_api(parent: Node, path: String, method: int, body: Dictionary, callback: Callable) -> void:
	if mock:
		callback.call(200, {"ok": true, "mock": true, "note": "mock mode — start Game Mode from the launcher to use the real engine"})
		return
	var req := HTTPRequest.new()
	parent.add_child(req)
	req.request_completed.connect(func(_result: int, code: int, _headers: PackedStringArray, raw: PackedByteArray) -> void:
		var parsed: Variant = JSON.parse_string(raw.get_string_from_utf8())
		callback.call(code, parsed if parsed is Dictionary else {})
		req.queue_free()
	)
	var headers := PackedStringArray([
		"Authorization: Bearer %s" % token,
		"Content-Type: application/json",
	])
	var payload := "" if method == HTTPClient.METHOD_GET else JSON.stringify(body)
	var err := req.request(base_url() + path, headers, method, payload)
	if err != OK:
		callback.call(0, {"error": "could not reach the builder engine (is the Workshop running?)"})
		req.queue_free()
