// scr_inventory
// Simple key-count inventory stored on global.inventory.

function init_inventory() {
    global.inventory = {
        clay:             5,
        pot:              2,
        fancy_pot:        0,
        wire:             10,
        fertilizer:       50,
        seed_juniper:     1,
        seed_maple:       1,
        cutting_juniper:  0,
        cutting_maple:    0,
    };
}

function inventory_add(_key, _amount = 1) {
    if (!variable_struct_exists(global.inventory, _key)) {
        global.inventory[$ _key] = 0;
    }
    global.inventory[$ _key] += _amount;
}

function inventory_remove(_key, _amount = 1) {
    if (!variable_struct_exists(global.inventory, _key)) return false;
    if (global.inventory[$ _key] < _amount) return false;
    global.inventory[$ _key] -= _amount;
    return true;
}

function inventory_has(_key, _amount = 1) {
    if (!variable_struct_exists(global.inventory, _key)) return false;
    return global.inventory[$ _key] >= _amount;
}

function inventory_count(_key) {
    if (!variable_struct_exists(global.inventory, _key)) return 0;
    return global.inventory[$ _key];
}