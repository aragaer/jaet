const towerList = {};
const structList = [];

function onTowersLoad() {
    var clist = document.getElementById("corporation");
    var slist = document.getElementById("system");
    CorpRefresh();
    setInterval(CorpRefresh, 60000);
    clist.addEventListener("command", function () {
            SysRefresh(clist.value);
            TowersRefresh(slist.value, clist.value);
        }, true);
    slist.addEventListener("command", function () {
            TowersRefresh(slist.value, clist.value);
        }, true);
    var limg = document.getElementById('loading');
    limg.width = limg.height;
}

function CorpRefresh() {
    var corplist = document.getElementById("corporation");
    var idx = corplist.selectedIndex;
    corplist.removeAllItems();
    for each (let corp in EveApi.getListOfCorps())
        corplist.appendItem(corp.name, corp.id);
    if (idx == -1 && corplist.itemCount)
        idx = 0;
    corplist.selectedIndex = idx;
    SysRefresh(corplist.value);
}

const ApiDB = EveApi.db;
function SysRefresh(corpid) {
    var sysList = document.getElementById("system");
    var systems = {};
    var idx = sysList.selectedIndex;
    
    if (idx < 0)
        idx = 0;

    sysList.removeAllItems();
    if (corpid) {
        EveApi.getCorporationTowersAsync(corpid, null, {
            onItem:         function (itm) {
                var l = itm.location;
                if (!l || systems[l])
                    return;
                systems[l] = 1;
                sysList.appendItem(itm.locationString(), l);
                sysList.disabled = false;
            },
            onCompletion:   function (r) {
                if (!sysList.itemCount) {
                    sysList.disabled = true;
                    sysList.appendItem("-", -1);
                    idx = 0;
                }

                sysList.selectedIndex = idx;
                TowersRefresh(sysList.value, corpid);
            },
            onError:        function (e) {
                dump("Getting POS locations: "+e+"\n");
            }
        });
    } else {
        sysList.disabled = true;
        sysList.appendItem("-", -1);
        sysList.selectedIndex = 0;
        TowersRefresh(sysList.value, corpid);
    }
}

function TowersRefresh(system, corpid) {
    var towlist = document.getElementById("towers");
    [delete i for each (i in towerList)];
    var waitingStructs = {};
    var haveStructs = 0;
    for (let i = towlist.itemCount; i--;)
        towlist.removeItemAt(0);

    towlist.appendItem("No towers found", -1);

    if (!system || system == -1)
        return;

    var limg = document.getElementById('loading');
    limg.src = "chrome://jaet/content/images/loading.gif";
    EveApi.getCorporationAssetsAsync(corpid, {
        onItem:     function (a) {
            if (a.location != system)
                return;

            if (!haveStructs++) {
                towlist.removeItemAt(0);
                var item = document.createElement('richlistitem');
                item.className = 'tower';
                item.setAttribute('name', "Unused/Offline");
                item.setAttribute('value', 0);
                towlist.appendChild(item);
                towerList.unused = item;
            }

            if (a.type.group.id == Ci.nsEveItemGroupID.GROUP_CONTROL_TOWER) {
                var item = document.createElement('richlistitem');
                item.setAttribute('name', a.name);
                item.className = 'tower';
                towlist.appendChild(item);
                item.tower = a;
                towerList[a.id] = item;
                if (waitingStructs[a.id]) {
                    waitingStructs[a.id].forEach(a.addStructure);
                    delete waitingStructs[a.id];
                }
            } else {
                EveApi.getStarbase(a.id, function (pos) {
                    if (!pos)
                        pos = 'unused';
                    if (towerList[pos])
                        towerList[pos].addStructure(a);
                    else {
                        if (!waitingStructs[pos])
                            waitingStructs[pos] = [];
                        waitingStructs[pos].push(a);
                    }
                });
            }
        },
        onError:    function (e) {
            dump("Get structures: "+e+"\n");
        },
        onCompletion: function (r) {
            limg.src = '';
        },
    });
}

function isSystem(loc) loc < 60000000

