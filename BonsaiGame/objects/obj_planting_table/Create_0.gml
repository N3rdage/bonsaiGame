// obj_planting_table — Create event
event_inherited();

prompt = "Plant Cutting";

on_interact = function() {
    var _panel = instance_create_depth(0, 0, -1000, obj_ui_plant_cutting);
    _panel.spawn_room = room;
    _panel.spawn_x = x + 48;   // spawn the new tree to the right of the table
    _panel.spawn_y = y;
};