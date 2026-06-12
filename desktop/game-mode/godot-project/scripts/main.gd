# ============================================================
# The hub — one cozy room, four stations (plan §23 prototype)
# ============================================================
# Website Workshop · Mobile App Workshop · Export Portal · the
# Retro Game Room door, plus the quest list and XP. All original
# art (plain shapes + text — same handmade spirit as the splash).
# Every station calls the safe MOCK action first, then its real
# engine call; the status line narrates honestly.
extends Control

const INK := Color("1A1612")
const CREAM := Color("F5EFE3")
const ACCENT := Color("B08842")

var status: Label
var quests_box: VBoxContainer
var profile_label: Label
var profile_id: String = ""

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
	title.text = "Baghdo's Workshop — Game Mode"
	title.add_theme_font_size_override("font_size", 30)
	title.add_theme_color_override("font_color", INK)
	root.add_child(title)

	profile_label = Label.new()
	profile_label.add_theme_color_override("font_color", ACCENT)
	root.add_child(profile_label)

	var row := HBoxContainer.new()
	row.add_theme_constant_override("separation", 16)
	root.add_child(row)

	_station(row, "🌐  Website Workshop", _on_website)
	_station(row, "📱  Mobile App Workshop", _on_mobile)
	_station(row, "📦  Export Portal", _on_export)
	_station(row, "🕹  Retro Game Room", _on_room)

	var controller_btn := Button.new()
	controller_btn.text = "🎮  Controller setup & test"
	controller_btn.pressed.connect(func() -> void: get_tree().change_scene_to_file("res://scenes/ControllerTest.tscn"))
	root.add_child(controller_btn)

	var quests_title := Label.new()
	quests_title.text = "Quests"
	quests_title.add_theme_font_size_override("font_size", 20)
	quests_title.add_theme_color_override("font_color", INK)
	root.add_child(quests_title)

	quests_box = VBoxContainer.new()
	root.add_child(quests_box)

	status = Label.new()
	status.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	status.add_theme_color_override("font_color", INK)
	root.add_child(status)

	if Bridge.mock:
		status.text = "Mock mode — exploring without the engine. Start Game Mode from the Workshop launcher for the real thing."
	_refresh()

func _station(row: HBoxContainer, label: String, handler: Callable) -> void:
	var b := Button.new()
	b.text = label
	b.custom_minimum_size = Vector2(230, 110)
	b.pressed.connect(handler)
	row.add_child(b)

func _refresh() -> void:
	Bridge.call_api(self, "/api/builder/game", HTTPClient.METHOD_GET, {}, func(code: int, body: Dictionary) -> void:
		if code != 200:
			status.text = str(body.get("error", "Could not reach the engine"))
			return
		var profiles: Array = body.get("profiles", [])
		if profiles.size() > 0:
			var p: Dictionary = profiles[0]
			profile_id = str(p.get("id", ""))
			profile_label.text = "%s · Level %s · %s XP" % [p.get("displayName", "?"), p.get("level", 1), p.get("xp", 0)]
		else:
			profile_label.text = "No profile yet — Normal Mode → portable/profiles creates one on first save."
		for child in quests_box.get_children():
			child.queue_free()
		var done: Dictionary = profiles[0].get("quests", {}) if profiles.size() > 0 else {}
		for q in body.get("quests", []):
			var line := Label.new()
			var mark := "✅" if done.has(q.get("id", "")) else "⬜"
			line.text = "%s  %s — %s (+%s XP)" % [mark, q.get("title", ""), q.get("hint", ""), q.get("xp", 0)]
			line.add_theme_color_override("font_color", INK)
			quests_box.add_child(line)
	)

# Each station: MOCK first (step 8), then the real engine call (step 9).
func _on_website() -> void:
	Bridge.call_api(self, "/api/builder/game", HTTPClient.METHOD_POST, {"action": "mock", "station": "website"}, func(_c: int, _b: Dictionary) -> void:
		Bridge.call_api(self, "/api/builder/game", HTTPClient.METHOD_POST, {"action": "list-projects"}, func(code: int, body: Dictionary) -> void:
			if code == 200:
				var projects: Array = body.get("projects", [])
				status.text = "Your website has %d page(s): %s. Edit them in Normal Mode — this hub cheers you on." % [projects.size(), ", ".join(PackedStringArray(projects))]
				_award("open-first-page")
			else:
				status.text = str(body.get("error", "engine unreachable"))
		)
	)

func _on_mobile() -> void:
	Bridge.call_api(self, "/api/builder/game", HTTPClient.METHOD_POST, {"action": "mock", "station": "mobile"}, func(_c: int, _b: Dictionary) -> void:
		status.text = "Mobile App Workshop: your pages already ARE the app — export an installable PWA or the Android/iOS projects at the Export Portal. Try the ▢ Screens grader in Normal Mode!"
		_award("try-a-preset")
	)

func _on_export() -> void:
	Bridge.call_api(self, "/api/builder/game", HTTPClient.METHOD_POST, {"action": "mock", "station": "export"}, func(_c: int, _b: Dictionary) -> void:
		status.text = "Exporting your static website through the REAL engine…"
		Bridge.call_api(self, "/api/builder/export", HTTPClient.METHOD_POST, {"target": "static"}, func(code: int, body: Dictionary) -> void:
			if code == 200:
				status.text = "🎉 Website exported: %s page(s) → %s" % [body.get("pages", "?"), body.get("outDir", "exports/")]
				_award("export-static")
			else:
				status.text = str(body.get("error", "export failed"))
		)
	)

func _on_room() -> void:
	_award("visit-the-room")
	get_tree().change_scene_to_file("res://scenes/RetroRoom.tscn")

func _award(quest_id: String) -> void:
	if profile_id == "":
		return
	Bridge.call_api(self, "/api/builder/game", HTTPClient.METHOD_POST, {"action": "quest", "profileId": profile_id, "questId": quest_id}, func(code: int, body: Dictionary) -> void:
		if code == 200 and body.get("awarded", false):
			status.text += "   (+XP! Level %s)" % body.get("level", 1)
		_refresh()
	)
