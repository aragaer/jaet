const accts = [];
const chars = [];
var acct_list, api_id, api_ltd, api_full, char_list;

function apiClose() {
    window.close();
}

function activate_check() {
    var id = api_id.value;
    var ltd = api_full.value;

    document.getElementById('btn-check').disabled = (id == '' || ltd == '');
}

function apiOpen() {
    acct_list = document.getElementById('acct-list');
    char_list = document.getElementById('char-list');
    api_id = document.getElementById('api-id');
    api_ltd = document.getElementById('api-limited');
    api_full = document.getElementById('api-full');

    acct_list.addEventListener('select', onAcctSelect, true);
    var accts_tmp = get_all_accounts();
    for (i in accts_tmp) {
        println(accts_tmp[i].join("|"));
        accts.push(accts_tmp[i]);
        var itm = acct_list.appendItem(accts_tmp[i][0]);
    }
}

function char_list_empty() {
    while (char_list.hasChildNodes()) {
        char_list.removeChild(char_list.firstChild);
    }
    chars.splice(0);
}

function onAcctSelect(aEvt) {
    var row = acct_list.selectedIndex;
    println("Acct select "+row);

    if (row == -1) {
        api_id.value = '';
        api_ltd.value = '';
        api_full.value = '';

        api_id.disabled = true;
        api_ltd.disabled = true;
        api_full.disabled = true;
        document.getElementById('btn-check').disabled = true;
        char_list_empty();
        return;
    }
    
    api_id.value = accts[row][1];
    api_ltd.value = accts[row][2];
    api_full.value = accts[row][3];

    var chars_tmp = load_characters(api_id.value);
    for (i in chars_tmp) {
        println(chars_tmp[i].join("|"));
        chars.push(chars_tmp[i]);
        char_list.appendItem(chars_tmp[i][0]);
    }

    api_id.disabled = false;
    api_ltd.disabled = false;
    api_full.disabled = false;
    activate_check();
}

function apiCheck() {
    var id = document.getElementById('api-id').value;
    var ltd = document.getElementById('api-limited').value;
    println("Checking keys "+id+":"+ltd);
    var ret = EveApiService.getCharacterList(id, ltd);
    if (!ret) {
        alert(document.getElementById('wrong-creds').value);
        return;
    }

    char_list_empty()

    for (node = ret.firstChild; node; node = node.nextSibling) {
        if (!node.hasAttributes())
            continue; 
        var li = document.createElement('listitem');
        li.setAttribute('label', node.getAttribute('name'));
        char_list.appendChild(li);
        chars.push([node.getAttribute('name'), node.getAttribute('characterID'), node.getAttribute('corporationID')]);
    }
    store_characters(id, chars);
}

function apiAdd() {
    accts.push(['','','','']);
    acct_list.appendItem('123');
}
