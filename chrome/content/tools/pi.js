var DrawingBoard, BoardHolder;
var evt;

function boardShowHide(aEvt) {
    if (aEvt.clientX || aEvt.clientY)
        evt = aEvt;
}

function AddPlanet(type) {
    if (!evt) {
        println("Evt is null!");
        return;
    }
    var circle = document.createElement("planet");
    println("created");
    println("appending");
    BoardHolder.appendChild(circle);
    println("appended");
//    circle.setAttribute('cx', evt.clientX);
//    circle.setAttribute('cy', evt.clientY);
    circle.x = evt.clientX;
    circle.y = evt.clientY;
    circle.type = type;

    println(circle.type+" planet created at "+circle.x+":"+circle.y);
    evt = null;
}

function PIOnLoad() {
    BoardHolder = document.getElementById('board_holder');
    document.getElementById('board').addEventListener('popupshowing', boardShowHide, true);
}

