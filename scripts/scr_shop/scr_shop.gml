// scr_shop
// Shop catalogue + purchase primitive. The catalogue lives on
// global.shop_catalogue so PR3 can rebalance prices without editing the
// panel UI. Transactions debit global.money and add to global.inventory.

function init_shop_catalogue() {
    // Reference points: starting money $100; score-50 displayed tree
    // earns ~5/day; selling that same tree pays $100. Prices below are
    // tuned against those numbers — supplies are an everyday spend,
    // fancy pot is a milestone purchase that pays itself back over weeks.
    global.shop_catalogue = [
        { key: "clay",       label: "Clay",       price: 4  },
        { key: "pot",        label: "Pot",        price: 12 },
        { key: "wire",       label: "Wire",       price: 8  },
        { key: "fertilizer", label: "Fertilizer", price: 10 },
        { key: "fancy_pot",  label: "Fancy Pot",  price: 80 },
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
