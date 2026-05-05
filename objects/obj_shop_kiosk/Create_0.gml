// obj_shop_kiosk — Create event
event_inherited();

prompt = "Shop";
on_interact = function() {
    instance_create_depth(0, 0, -1000, obj_ui_shop);
};
