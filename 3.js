const playPreorderBtn=document.getElementById("play_preorder");
const playInorderBtn=document.getElementById("play_inorder");
const playPostorderBtn=document.getElementById("play_postorder");
const playBFSBtn=document.getElementById("play_bfs");
const bpmRange=document.getElementById("bpm_range");
const bpmVal=document.getElementById("bpm_val");
// --- Audio setup ---
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
const notes = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
const noteFreqs = {};
for (let octave = 0; octave < 9; octave++) { // C0 to B8
  for (let i = 0; i < notes.length; i++) {
    const note = notes[i];
    const n = i + 12 * (octave - 4) - 9; // semitone offset from A4
    const freq = 440 * Math.pow(2, n / 12);
    const noteName = `${note}${octave}`;
    noteFreqs[noteName] = Math.round(freq * 100) / 100; // round to 2 decimals
  }
}
console.log(noteFreqs);
let bpm=140;
let quarter=60/bpm;

bpmRange.addEventListener("input", () => {
    bpm = bpmRange.value;
    bpmVal.textContent = bpm;
    quarter = 60 / bpm;
});

class Node {
    constructor(note, duration) {
        this.note = note;
        this.duration = duration;
        this.left = null;
        this.right = null;
    }
}

// Create a small binary tree
const root = new Node("C4", 0.5);
root.left = new Node("C4", 0.5);
root.right = new Node("F4", 1.0);
root.left.left = new Node("D4", 1.0);
root.left.right = new Node("C4", 1.0);
root.right.left = new Node("E4", 2.0);
root.right.right = new Node("REST", 1.0);

// --- Visualization ---
const svg = document.getElementById("tree");
const width = svg.clientWidth;
const levelHeight = 100;

function layoutTree(root) {
    let x = 0;
    function assign(node, depth = 0) {
        if (!node) return;
        assign(node.left, depth + 1);
        node.x = x++;
        node.y = depth;
        assign(node.right, depth + 1);
    }
    assign(root);

    let nodes = [];
    function collect(n) {
        if (!n) return;
        nodes.push(n);
        collect(n.left);
        collect(n.right);
    }
    collect(root);

    const spacingX = width / (x + 1);
    for (let n of nodes) {
        n.x = (n.x + 1) * spacingX;
        n.y = (n.y + 1) * levelHeight + 40;
    }
    return nodes;
}

function drawTree(root) {
    const nodes = layoutTree(root);
    const edges = [];
    for (const n of nodes) {
        if (n.left) edges.push([n, n.left]);
        if (n.right) edges.push([n, n.right]);
    }

    // draw edges
    for (const [p, c] of edges) {
        const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
        line.setAttribute("x1", p.x);
        line.setAttribute("y1", p.y);
        line.setAttribute("x2", c.x);
        line.setAttribute("y2", c.y);
        line.setAttribute("class", "edge");
        svg.appendChild(line);
    }

    // draw nodes
    for (const n of nodes) {
        const g = document.createElementNS("http://www.w3.org/2000/svg", "g");
        g.setAttribute("class", "node");
        g.setAttribute("transform", `translate(${n.x},${n.y})`);

        const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
        circle.setAttribute("r", 40);
        circle.setAttribute("fill", "white");
        g.appendChild(circle);

        const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
        text.textContent = `${n.note}\n(${n.duration})`;
        text.setAttribute("dy", "4");
        g.appendChild(text);

        svg.appendChild(g);
        n.svgElement = circle;
        n.textElement = text;

        // Click listener for popup
        circle.addEventListener("click", (e) => {
        e.stopPropagation();
        openPopup(n, e.clientX, e.clientY);
        });
    }
}

drawTree(root);

// --- Popup editor ---
const popup = document.getElementById("popup");
const popupNote = document.getElementById("popup_note");
const popupOctave = document.getElementById("popup_octave");
const popupDuration = document.getElementById("popup_duration");
const popupApply = document.getElementById("popup_apply");
const popupCancel = document.getElementById("popup_cancel");
const popupDelete = document.getElementById("popup_delete");
const notes_w_rest = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B","R"];
notes_w_rest.forEach(note => {
    const opt = document.createElement("option");
    opt.value = note;
    opt.textContent = note;
    popupNote.appendChild(opt);
});
for (let o = 0; o <= 8; o++) {
    const opt = document.createElement("option");
    opt.value = o;
    opt.textContent = o;
    popupOctave.appendChild(opt);
}

let currentNode = null;

function openPopup(node, x, y) {
    currentNode = node;
    popup.style.display = "flex";
    popup.style.left = `${x + 10}px`;
    popup.style.top = `${y - 10}px`;

    // Parse node.note (e.g., "C4")
    const match = node.note.match(/^([A-G]#?)(\d)$/);
    if (match) {
        popupNote.value = match[1];
        popupOctave.value = match[2];
    } else {
        popupNote.value = "C";
        popupOctave.value = 4;
    }
    popupDuration.value = node.duration;

    // Check if node is a leaf (no children)
    const isLeaf = !node.left && !node.right;
    popupDelete.style.display = isLeaf ? "inline-block" : "none";
}

popupApply.addEventListener("click", () => {
    if (!currentNode) return;
    const note = popupNote.value + popupOctave.value;
    const duration = parseFloat(popupDuration.value);
    currentNode.note = note;
    currentNode.duration = duration;
    currentNode.textElement.textContent = `${note}\n(${duration})`;
    popup.style.display = "none";
    currentNode = null;
});
popupCancel.addEventListener("click", () => {
    popup.style.display = "none";
    currentNode = null;
});
popupDelete.addEventListener("click", () => {
    if (!currentNode) return;
    // Only delete if leaf
    function deleteNode(parent, child) {   
            if (!parent) return false;
            if (parent.left === child) {
                parent.left = null;
                return true;
            }
            if (parent.right === child) {
                parent.right = null;
                return true;
            }
            return deleteNode(parent.left, child) || deleteNode(parent.right, child);
        }
        deleteNode(root, currentNode);
        // Remove from SVG
        svg.innerHTML = ""; // Clear SVG
        drawTree(root); // Redraw tree
        popup.style.display = "none";
        currentNode = null;
});
document.addEventListener("click", (e) => {
    if (popup.style.display === "flex" && !popup.contains(e.target)) {
        popup.style.display = "none";
        currentNode = null;
    }
    if (seqPopup.style.display === "flex" && !seqPopup.contains(e.target)) {
        seqPopup.style.display = "none";
        currentNode = null;
    }
});



function playNote(note, duration) {
    const freq = noteFreqs[note];
    if (!freq) return;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.frequency.value = freq;
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start();
    gain.gain.setValueAtTime(0.2, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);
    osc.stop(audioCtx.currentTime + duration);
}

// --- Preorder traversal (animated) ---
async function preorderPlay(node) {
    if (!node) return;
    // highlight
    node.svgElement.setAttribute("fill", "yellow");
    playNote(node.note, node.duration);
    await new Promise(r => setTimeout(r, node.duration * 1000 * quarter));
    // unhighlight
    node.svgElement.setAttribute("fill", "white");
    await preorderPlay(node.left);
    await preorderPlay(node.right);
}
async function inorderPlay(node) {
    if (!node) return;
    await inorderPlay(node.left);
    // highlight
    node.svgElement.setAttribute("fill", "yellow");
    playNote(node.note, node.duration);
    await new Promise(r => setTimeout(r, node.duration * 1000 * quarter));
    // unhighlight
    node.svgElement.setAttribute("fill", "white");
    await inorderPlay(node.right);
}
async function postorderPlay(node) {
    if (!node) return;
    await postorderPlay(node.left);
    await postorderPlay(node.right);
    // highlight
    node.svgElement.setAttribute("fill", "yellow");
    playNote(node.note, node.duration);
    await new Promise(r => setTimeout(r, node.duration * 1000 * quarter));
    // unhighlight
    node.svgElement.setAttribute("fill", "white");
}
async function BFSPlay(node) {
    if (!node) return;

    const queue = [node];
    while (queue.length > 0) {
        const current = queue.shift();

        // highlight
        current.svgElement.setAttribute("fill", "yellow");
        playNote(current.note, current.duration);
        await new Promise(r => setTimeout(r, current.duration * 1000 * quarter));
        // unhighlight
        current.svgElement.setAttribute("fill", "white");

        if (current.left) queue.push(current.left);
        if (current.right) queue.push(current.right);
    }
}


// setTimeout(() => preorderPlay(root), 1000); // start after 1 second
playPreorderBtn.addEventListener("click", () => {
    bpm=bpmRange.value;
    quarter=60/bpm;
    preorderPlay(root);
});
playInorderBtn.addEventListener("click", () => {
    bpm=bpmRange.value;
    quarter=60/bpm;
    inorderPlay(root);
});
playPostorderBtn.addEventListener("click", () => {
    bpm=bpmRange.value;
    quarter=60/bpm;
    postorderPlay(root);
});
playBFSBtn.addEventListener("click", () => {
    bpm=bpmRange.value;
    quarter=60/bpm;
    BFSPlay(root);
});

const seqAppendBtn=document.getElementById("seq_append_btn");
const seqPopup = document.getElementById("seq_popup");
const seqPopupNote = document.getElementById("seq_popup_note");
const seqPopupOctave = document.getElementById("seq_popup_octave");
const seqPopupDuration = document.getElementById("seq_popup_duration");
const seqPopupApply = document.getElementById("seq_popup_apply");
const seqPopupCancel = document.getElementById("seq_cancel");
notes_w_rest.forEach(note => {
    const opt = document.createElement("option");
    opt.value = note;
    opt.textContent = note;
    seqPopupNote.appendChild(opt);
});
for (let o = 0; o <= 8; o++) {
    const opt = document.createElement("option");
    opt.value = o;
    opt.textContent = o;
    seqPopupOctave.appendChild(opt);
}
seqAppendBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    openSeqPopup(seqAppendBtn.getBoundingClientRect().right, seqAppendBtn.getBoundingClientRect().top);
})
seqPopupCancel.addEventListener("click", () => {
    seqPopup.style.display = "none";
    currentNode = null;
});

function openSeqPopup(x, y) {
    console.log("Opening seq popup");
    seqPopup.style.display = "flex";
    seqPopup.style.left = `${x + 10}px`;
    seqPopup.style.top = `${y - 10}px`;

    // Parse node.note (e.g., "C4")
    const match = root.note.match(/^([A-G]#?)(\d)$/);
    if (match) {
        seqPopupNote.value = match[1];
        seqPopupOctave.value = match[2];
    } else {
        seqPopupNote.value = "C";
        seqPopupOctave.value = 4;
    }
    seqPopupDuration.value = root.duration;
}
