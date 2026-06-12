# ============================================================
# Controller setup & test — strictly brand-neutral (plan §23)
# ============================================================
# Press buttons, see what's detected. Godot's input layer ships
# SDL controller mappings, so modern (and future) pads map to the
# same generic events. THE LAW: the UI never names a console
# brand — hardware is "Generic Controller #N", buttons are plain
# words. (Internally Godot may know the device string; we keep it
# out of the UI on purpose.)
extends Control

const INK := Color("1A1612")
const CREAM := Color("F5EFE3")

# Brand-neutral names for Godot's generic JoyButton indices.
const BUTTON_NAMES := {
	JOY_BUTTON_A: "A button",
	JOY_BUTTON_B: "B button",
	JOY_BUTTON_X: "X button",
	JOY_BUTTON_Y: "Y button",
	JOY_BUTTON_LEFT_SHOULDER: "L1 button",
	JOY_BUTTON_RIGHT_SHOULDER: "R1 button",
	JOY_BUTTON_LEFT_STICK: "Left stick click",
	JOY_BUTTON_RIGHT_STICK: "Right stick click",
	JOY_BUTTON_DPAD_UP: "D-pad up",
	JOY_BUTTON_DPAD_DOWN: "D-pad down",
	JOY_BUTTON_DPAD_LEFT: "D-pad left",
	JOY_BUTTON_DPAD_RIGHT: "D-pad right",
	JOY_BUTTON_START: "Start button",
	JOY_BUTTON_BACK: "Select button",
	JOY_BUTTON_GUIDE: "Home-style button",
}

const AXIS_NAMES := {
	JOY_AXIS_LEFT_X: "Left stick (horizontal)",
	JOY_AXIS_LEFT_Y: "Left stick (vertical)",
	JOY_AXIS_RIGHT_X: "Right stick (horizontal)",
	JOY_AXIS_RIGHT_Y: "Right stick (vertical)",
	JOY_AXIS_TRIGGER_LEFT: "L2 trigger",
	JOY_AXIS_TRIGGER_RIGHT: "R2 trigger",
}

var detected: Label
var last_input: Label

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
	title.text = "🎮  Controller setup & test"
	title.add_theme_font_size_override("font_size", 28)
	title.add_theme_color_override("font_color", INK)
	root.add_child(title)

	detected = Label.new()
	detected.add_theme_color_override("font_color", INK)
	root.add_child(detected)

	last_input = Label.new()
	last_input.text = "Press any button or move a stick…"
	last_input.add_theme_font_size_override("font_size", 22)
	last_input.add_theme_color_override("font_color", INK)
	root.add_child(last_input)

	var hint := Label.new()
	hint.text = "Mappings (button → keyboard key / mouse) are saved per game in Normal Mode and applied by each game's emulator profile. DOSBox-X profiles get a generated mapper; VM-era games configure input inside the VM."
	hint.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	hint.add_theme_color_override("font_color", INK)
	root.add_child(hint)

	var back := Button.new()
	back.text = "← Back to the hub"
	back.pressed.connect(func() -> void: get_tree().change_scene_to_file("res://scenes/Main.tscn"))
	root.add_child(back)

	Input.joy_connection_changed.connect(func(_id: int, _connected: bool) -> void: _refresh_detected())
	_refresh_detected()

func _refresh_detected() -> void:
	var pads := Input.get_connected_joypads()
	if pads.is_empty():
		detected.text = "No controller detected — plug one in (USB or Bluetooth) and it appears here."
	else:
		var names: Array[String] = []
		for id in pads:
			names.append("Generic Controller #%d" % id)  # brand-neutral, always
		detected.text = "Detected: " + ", ".join(names)

func _input(event: InputEvent) -> void:
	if event is InputEventJoypadButton and event.pressed:
		last_input.text = "Pressed: %s" % BUTTON_NAMES.get(event.button_index, "Button %d" % event.button_index)
	elif event is InputEventJoypadMotion and absf(event.axis_value) > 0.5:
		last_input.text = "Moved: %s" % AXIS_NAMES.get(event.axis, "Axis %d" % event.axis)
