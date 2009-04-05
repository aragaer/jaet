function apiClose() {
    window.close();
}

function activate_check() {
    var id = document.getElementById('api-id').value;
    var ltd = document.getElementById('api-limited').value;

    document.getElementById('btn-check').disabled = (id == '' || ltd == '');
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

    var list = document.getElementById('char-list');

    for (node = ret.firstChild; node; node = node.nextSibling) {
        if (!node.hasAttributes())
            continue; 
        var li = document.createElement('listitem');
        li.setAttribute('label', node.getAttribute('name'));
        list.appendChild(li);
    }
}
