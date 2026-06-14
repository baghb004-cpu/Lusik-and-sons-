# ============================================================
# The Retro Game Room — cozy shelves for YOUR OWN games
# ============================================================
# Renders the library the engine serves (/api/builder/retro):
# shelves of user-added entries, Launch with the explicit
# "this is the exact command" confirm step, missing files shown
# with the Locate-Again hint, the honest save-tier per game.
# Disabled by default — the engine answers 403 until the owner
# flips portable/settings.json locally, and this room says so
# kindly instead of crashing.
extends Control

const INK := Color("1A1612")
const CREAM := Color("EFE6D4")  # a touch warmer — it's the den, not the office
const ACCENT := Color("B08842")

var status: Label
var shelf: VBoxContainer
var pending_launch: String = ""

func _ready() -> void:
	var bg := ColorRect.new()
	bg.color = CREAM
	bg.set_anchors_preset(Control.PRESET_FULL_RECT)
	add_child(bg)

	var root := VBoxContainer.new()
	root.set_anchors_preset(Control.PRESET_FULL_RECT)
	root.offset_left = 40
	root.offset_top = 28
	root.offset_right = -40
	root.offset_bottom = -28
	add_child(root)

	var title := Label.new()
	title.text = "🕹  The Retro Game Room"
	title.add_theme_font_size_override("font_size", 28)
	title.add_theme_color_override("font_color", INK)
	root.add_child(title)

	var note := Label.new()
	note.text = "Your own discs and backups only — this room organizes media you legally own. Nothing is downloaded."
	note.add_theme_color_override("font_color", ACCENT)
	note.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	root.add_child(note)

	shelf = VBoxContainer.new()
	shelf.add_theme_constant_override("separation", 8)
	root.add_child(shelf)

	status = Label.new()
	status.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	status.add_theme_color_override("font_color", INK)
	root.add_child(status)

	var actions := HBoxContainer.new()
	actions.add_theme_constant_override("separation", 10)
	root.add_child(actions)

	var back := Button.new()
	back.text = "← Exit room"
	back.pressed.connect(func() -> void: get_tree().change_scene_to_file("res://scenes/Main.tscn"))
	actions.add_child(back)

	var wizard := Button.new()
	wizard.text = "🛠 Setup wizard"
	wizard.pressed.connect(func() -> void: get_tree().change_scene_to_file("res://scenes/SetupWizard.tscn"))
	actions.add_child(wizard)

	var backup := Button.new()
	backup.text = "💾 Back up saves & library"
	backup.pressed.connect(func() -> void:
		Bridge.call_api(self, "/api/builder/portable", HTTPClient.METHOD_POST, {"kind": "backup"}, func(code: int, body: Dictionary) -> void:
			status.text = str(body.get("note", body.get("error", ""))) if code == 200 else str(body.get("error", "backup failed"))
			if code == 200:
				status.text = "💾 Backed up to portable/%s — %s" % [body.get("file", "?"), body.get("note", "")]
		)
	)
	actions.add_child(backup)

	_load_library()

func _load_library() -> void:
	Bridge.call_api(self, "/api/builder/retro", HTTPClient.METHOD_GET, {}, func(code: int, body: Dictionary) -> void:
		if code == 403:
			status.text = str(body.get("error", "The room is switched off.")) + "  The Setup wizard above can turn it on."
			return
		if code != 200:
			status.text = str(body.get("error", "Could not open the room."))
			return
		var games: Array = body.get("games", [])
		if games.is_empty():
			status.text = "Empty shelves! Add your games in Normal Mode (or via the API): title, your ISO/disc, and an era profile — they'll appear here forever after."
			return
		for g in games:
			_shelf_row(g)
	)

func _shelf_row(g: Dictionary) -> void:
	var row := HBoxContainer.new()
	row.add_theme_constant_override("separation", 12)
	var label := Label.new()
	var missing: Array = g.get("missing", [])
	var tier := str(g.get("saveTier", "?"))
	var badge := "🟢 Ready" if missing.is_empty() else ("🔴 Missing disc/ISO" if str(missing[0].get("field", "")) == "isoPath" else "🟡 Needs setup")
	label.text = "📀 %s  [%s · saves: %s]  %s" % [g.get("title", "?"), g.get("category", "?"), tier, badge]
	label.add_theme_color_override("font_color", INK)
	row.add_child(label)
	if missing.size() > 0:
		var warn := Label.new()
		warn.text = "⚠ file moved — Locate File Again (in Normal Mode): %s" % str(missing[0].get("field", ""))
		warn.add_theme_color_override("font_color", Color("B00020"))
		row.add_child(warn)
	else:
		var btn := Button.new()
		btn.text = "▶ Launch"
		btn.pressed.connect(func() -> void: _launch(str(g.get("id", "")), false))
		row.add_child(btn)
	shelf.add_child(row)

func _launch(id: String, confirmed: bool) -> void:
	Bridge.call_api(self, "/api/builder/retro", HTTPClient.METHOD_POST, {"action": "launch", "id": id, "confirm": confirmed}, func(code: int, body: Dictionary) -> void:
		if code != 200:
			status.text = str(body.get("error", "launch failed")) + ("  Hint: " + str(body.get("hint", "")) if body.has("hint") else "")
			return
		if body.get("needsConfirm", false):
			var cmd: Dictionary = body.get("command", {})
			status.text = "About to run: %s %s\nSaves: %s. Press Launch again within this room to confirm." % [cmd.get("bin", "?"), " ".join(PackedStringArray(cmd.get("args", []))), body.get("saveTier", "?")]
			pending_launch = id
			var confirm := Button.new()
			confirm.text = "✓ Yes, run it"
			confirm.pressed.connect(func() -> void:
				_launch(id, true)
				confirm.queue_free()
			)
			shelf.add_child(confirm)
		elif body.get("launched", false):
			status.text = "Have fun! 🎉  (saves: %s)" % body.get("saveTier", "?")
	)
