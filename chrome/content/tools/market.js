const MarketService = initMarketService();
var region_name;
var item_list;
var price_alg;

const items = [];
const ItemsTreeView = {  
    rowCount : 0,
    getCellText : function (row,column) {
        return items[row][column.id];
    },
    setTree: function (treebox) { this.treebox = treebox; },
    isContainer: function (row) { return false; },
    isSeparator: function (row) { return false; },
    isSorted: function () { return false; },
    getLevel: function (row) { return 0; },
    getImageSrc: function (row,col) { return null; },
    getRowProperties: function (row,props) {},
    getCellProperties: function (row,col,props) {},
    getColumnProperties: function (colid,col,props) {}
};

function is_buy(order) { return order.bid == 'True'; }
function is_sell(order) { return order.bid == 'False'; }
function get_price(order) { return order.price; }

const price_algs = {
    min_sale:   {
        name:   "Minimum sell",
        desc:   "Minimum sell price over current region",
        func:   function (orders) {
            var min = Number.POSITIVE_INFINITY;
            orders.filter(is_sell).map(get_price).
                forEach(function (price) {
                    if (min > price)
                        min = price;
                });
            return min;
        },
    },
};

function initMarketService() {
    var marketPath = getCharPref('jaet.exports.dir');
    var res = Cc["@aragaer.com/eve-market-export/service;1"].
        getService(Ci.nsIEveMarketExportService);
    res.initWithPath(marketPath);
    return res;
}

function marketOnLoad() {
    region_name = document.getElementById('region-name');
    item_list = document.getElementById('items');
    price_alg = document.getElementById('price-alg');

    for (i in price_algs) {
        price_alg.appendItem(price_algs[i].name, i, price_algs[i].desc);
    }

    price_alg.selectedIndex = 0;
}

function check_market() {
    var exports = MarketService.getExportsByRegion(region_name.value,{});
    items.splice(0);
    exports.forEach(function (a) {
        items.push(make_item(a));
    });

    ItemsTreeView.rowCount = items.length;
    item_list.view = ItemsTreeView;
}

const headers = ['price', 'volRemaining', 'typeID', 'range', 'orderID',
	'volEntered', 'minVolume', 'bid', 'issued', 'duration', 'stationID',
	'regionID', 'solarSystemID', 'jumps'];

function make_price(orders) {
    return (price_algs[price_alg.value].func)(orders);
}

function make_item(obj) {
    var pricelist = [];
    var istream = Cc["@mozilla.org/network/file-input-stream;1"].
            createInstance(Ci.nsIFileInputStream);
    istream.init(obj.file, 0x01, 0444, 0);
    istream.QueryInterface(Ci.nsILineInputStream);

    var line = {}, lines = [], hasmore;
    do {
        hasmore = istream.readLine(line);
        lines.push(line.value); 
    } while(hasmore);

    istream.close();

    lines.forEach(function (line) {
        var fields = line.split(',');
        var record = {};
        fields.pop(); // trailing colon
        for (i in headers)
            record[headers[i]] = fields[i];

        record.price = +record.price; //magic - convert to number
        pricelist.push(record);
    });
    
    return {
        itm: obj.item,
        isk: make_price(pricelist),
        date: (new Date(obj.date)).toUTCString(),
    };
}
