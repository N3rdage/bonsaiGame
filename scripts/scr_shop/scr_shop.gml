// scr_shop
// Shop catalogue + purchase primitive. The catalogue lives on
// global.shop_catalogue so PR3 can rebalance prices without editing the
// panel UI. Transactions debit global.money and add to global.inventory.

function init_shop_catalogue() {
    global.shop_catalogue = [
        { key: "clay",       label: "Clay",       price: 5  },
        { key: "wire",       label: "Wire",       price: 10 },
        { key: "fertilizer", label: "Fertilizer", price: 8  },
    ];
}

// Buy _qty of _key at _unit_price each. Returns true on success
// (money debited, inventory increased), false if the player can't afford.
function shop_buy(_key, _qty, _unit_price) {
    var _total = _qty * _unit_price;
    if (global.money < _total) return false;
    global.money -= _total;
    inventory_add(_key, _qty);
    return true;
}
