# ============================================================
# Retro Game Room — first-run setup wizard (plan §23b)
# ============================================================
# One screen, the whole truth: every row is Ready / Missing /
# Optional with a real Fix button when the engine can fix it
# (enable the room, create folders, seed era + controller
# profiles) and official-download guidance when only Baghdo can
# supply it (his Windows media, his discs — never a button, by
# law). Works even while the room is disabled: that's the point.
extends Control

const INK := Color("1A1612")
const CREAM := Color("F5EFE3")
const GOOD := Color("1B7A3D")
const BAD := Color("B00020")
const SOFT := Color("6B655D")

var rows: VBoxContainer
var summary: Label

func _ready() -> void:
	var bg := ColorRect.new()
	bg.color = CREAM
	bg.set_anchors_preset(Control.PRESET_FULL_RECT)
	add_child(bg)

	var scroll := ScrollContainer.new()
	scroll.set_anchors_preset(Control.PRESET_FULL_RECT)
	scroll.offset_left = 40
	scroll.offset_top = 24
	scroll.offset_right = -40
	scroll.offset_bottom = -24
	add_child(scroll)

	var root := VBoxContainer.new()
	root.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	scroll.add_child(root)

	var title := Label.new()
	title.text = "🛠  Retro Game Room — setup"
	title.add_theme_font_size_override("font_size", 26)
	title.add_theme_color_override("font_color", INK)
	root.add_child(title)

	summary = Label.new()
	summary.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	summary.add_theme_color_override("font_color", SOFT)
	root.add_child(summary)

	rows = VBoxContainer.new()
	rows.add_theme_constant_override("separation", 6)
	root.add_child(rows)

	var back := Button.new()
	back.text = "← Back"
	back.pressed.connect(func() -> void: get_tree().change_scene_to_file("res://scenes/RetroRoom.tscn"))
	root.add_child(back)

	_load()

func _load() -> void:
	for child in rows.get_children():
		child.queue_free()
	Bridge.call_api(self, "/api/builder/retro?wizard=1", HTTPClient.METHOD_GET, {}, func(code: int, body: Dictionary) -> void:
		if code != 200:
			summary.text = str(body.get("error", "Could not reach the engine."))
			return
		var s: Dictionary = body.get("summary", {})
		summary.text = "%s  (%s ready · %s to go)" % [s.get("verdict", ""), s.get("ready", "?"), s.get("missing", "?")]
		for item in body.get("health", []):
			_row(item)
		_templates_row(body.get("templates", []))
	)

func _row(item: Dictionary) -> void:
	var line := HBoxContainer.new()
	line.add_theme_constant_override("separation", 10)
	var badge := Label.new()
	var status := str(item.get("status", "info"))
	badge.text = {"ready": "✅", "missing": "❌", "optional": "○", "info": "ℹ"}.get(status, "ℹ")
	line.add_child(badge)

	var text := Label.new()
	text.text = "%s — %s" % [item.get("label", ""), item.get("detail", "")]
	text.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	text.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	text.add_theme_color_override("font_color", GOOD if status == "ready" else (BAD if status == "missing" else SOFT))
	line.add_child(text)

	if item.has("fix"):
		var fix: Dictionary = item.get("fix")
		var btn := Button.new()
		btn.text = "🔧 " + str(fix.get("label", "Fix this"))
		btn.pressed.connect(func() -> void:
			Bridge.call_api(self, "/api/builder/retro", HTTPClient.METHOD_POST, {"action": "fix", "fix": fix.get("action", "")}, func(_c: int, _b: Dictionary) -> void:
				_load()
			)
		)
		line.add_child(btn)
	elif item.has("guidance"):
		var g: Dictionary = item.get("guidance")
		var hint := Label.new()
		hint.text = "→ " + str(g.get("label", ""))
		hint.add_theme_color_override("font_color", SOFT)
		line.add_child(hint)
	rows.add_child(line)

func _templates_row(templates: Array) -> void:
	if templates.is_empty():
		return
	var head := Label.new()
	head.text = "🧱  Ready-made launch profiles (bring your own disc/ISO, adopt in Normal Mode or the room):"
	head.add_theme_color_override("font_color", INK)
	rows.add_child(head)
	for t in templates:
		var line := Label.new()
		line.text = "   • %s (%s) — %s · %s" % [t.get("title", ""), t.get("year", ""), t.get("recommendedBackend", ""), t.get("expects", "")]
		line.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
		line.add_theme_color_override("font_color", SOFT)
		rows.add_child(line)
