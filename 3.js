const playPreorderBtn=document.getElementById("play_preorder");
const playInorderBtn=document.getElementById("play_inorder");
const playPostorderBtn=document.getElementById("play_postorder");
const playBFSBtn=document.getElementById("play_bfs");
const bpmRange=document.getElementById("bpm_range");
const bpmVal=document.getElementById("bpm_val");

const stopBtn = document.getElementById("stop");
const pauseBtn = document.getElementById("pause");
const resumeBtn = document.getElementById("resume");

let isPaused = false;
let pausePromise = null;
let resume = null;
let stopRequested = false;

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
// const root = new Node("C4", 0.5);
// root.left = new Node("C4", 0.5);
// root.right = new Node("F4", 1.0);
// root.left.left = new Node("D4", 1.0);
// root.left.right = new Node("C4", 1.0);
// root.right.left = new Node("E4", 2.0);
// root.right.right = new Node("REST", 1.0);

const root = new Node("C4", 0.5);

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

    const spacingX = 40; // horizontal spacing between nodes
    const levelHeight = 80; // vertical spacing between levels

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


function positionPopup(popup, x, y) {
    const margin = 10;                      // space around popup
    const rect = popup.getBoundingClientRect();
    let left = x + margin;
    let top = y - margin;

    // If popup goes off the right edge → move left
    if (left + rect.width > window.innerWidth) {
        left = x - rect.width - margin;
    }

    // If popup goes off the bottom → move upward
    if (top + rect.height > window.innerHeight) {
        top = window.innerHeight - rect.height - margin;
    }

    // If popup goes off the left side → clamp to margin
    if (left < margin) left = margin;

    // If popup goes off the top → clamp to margin
    if (top < margin) top = margin;

    popup.style.left = `${left}px`;
    popup.style.top = `${top}px`;
}

function closeAllPopups() {
    popup.style.display = "none";
    seqPopup.style.display = "none";
    seqEditPopup.style.display = "none";

    introPopup.style.display = "none";
    helpPopup.style.display = "none";

    currentNode = null;
    currentItem = null;
}


// --- Popup editor ---
const popup = document.getElementById("popup");
const popupNote = document.getElementById("popup_note");
const popupOctave = document.getElementById("popup_octave");
const popupDuration = document.getElementById("popup_duration");
const popupApply = document.getElementById("popup_apply");
const popupCancel = document.getElementById("popup_cancel");
const popupDelete = document.getElementById("popup_delete");
const notes_w_rest = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B","R"];

// --- Sequence Input Popup ---
const seqAppendBtn = document.getElementById("seq_append_btn");
const seqPopup = document.getElementById("seq_popup");
const seqPopupNote = document.getElementById("seq_popup_note");
const seqPopupOctave = document.getElementById("seq_popup_octave");
const seqPopupDuration = document.getElementById("seq_popup_duration");
const seqPopupApply = document.getElementById("seq_apply");
const seqPopupCancel = document.getElementById("seq_cancel");

const seqBar = document.getElementById("seq_bar");

// --- Sequence Input Edit Popup ---
const seqEditPopup = document.getElementById("seq_edit_popup");
const seqEditPopupNote = document.getElementById("seq_edit_popup_note");
const seqEditPopupOctave = document.getElementById("seq_edit_popup_octave");
const seqEditPopupDuration = document.getElementById("seq_edit_popup_duration");
const seqEditPopupApply = document.getElementById("seq_edit_apply");
const seqEditPopupCancel = document.getElementById("seq_edit_cancel");
const seqEditPopupDelete = document.getElementById("seq_edit_delete");



notes_w_rest.forEach(note => {
    const opt = document.createElement("option");
    opt.value = note;
    opt.textContent = note;
    popupNote.appendChild(opt);
    seqPopupNote.appendChild(opt.cloneNode(true));
    seqEditPopupNote.appendChild(opt.cloneNode(true));
});
for (let o = 0; o <= 8; o++) {
    const opt = document.createElement("option");
    opt.value = o;
    opt.textContent = o;
    popupOctave.appendChild(opt);
    seqPopupOctave.appendChild(opt.cloneNode(true));
    seqEditPopupOctave.appendChild(opt.cloneNode(true));
}

let currentNode = null;

function openPopup(node, x, y) {
    closeAllPopups();
    currentNode = node;
    popup.style.display = "flex";
    positionPopup(popup, x, y);

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

    // If click is inside any popup, DO NOTHING
    if (
        popup.contains(e.target) ||
        seqPopup.contains(e.target) ||
        seqEditPopup.contains(e.target) ||
        introPopup.contains(e.target) ||
        helpPopup.contains(e.target)
    ) return;

    // Otherwise close all popups
    closeAllPopups();
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
    if (!node || stopRequested) return;

    await checkPaused();
    node.svgElement.setAttribute("fill", "yellow");

    await checkPaused();
    playNote(node.note, node.duration);

    await checkPaused();
    await new Promise(r => setTimeout(r, node.duration * 1000 * quarter));

    node.svgElement.setAttribute("fill", "white");

    await checkPaused();
    await preorderPlay(node.left);

    await checkPaused();
    await preorderPlay(node.right);
}
async function inorderPlay(node) {
    if (!node || stopRequested) return;
    await checkPaused();
    await inorderPlay(node.left);

    if (stopRequested) return;
    await checkPaused();
    node.svgElement.setAttribute("fill", "yellow");
    playNote(node.note, node.duration);

    await checkPaused();
    await new Promise(r => setTimeout(r, node.duration * 1000 * quarter));

    node.svgElement.setAttribute("fill", "white");

    if (stopRequested) return;
    await checkPaused();
    await inorderPlay(node.right);
}

async function postorderPlay(node) {
    if (!node || stopRequested) return;
    await checkPaused();
    await postorderPlay(node.left);
    if (stopRequested) return;
    await checkPaused();
    await postorderPlay(node.right);
    if (stopRequested) return;
    await checkPaused();
    node.svgElement.setAttribute("fill", "yellow");

    if (stopRequested) return;
    await checkPaused();
    playNote(node.note, node.duration);
    await checkPaused();
    await new Promise(r => setTimeout(r, node.duration * 1000 * quarter));
    node.svgElement.setAttribute("fill", "white");
}

async function BFSPlay(root) {
    if (!root || stopRequested) return;
    const queue = [root];

    while (queue.length > 0) {

        await checkPaused();
        if (stopRequested) return;

        const node = queue.shift();
        if (!node) continue;

        node.svgElement.setAttribute("fill", "yellow");

        if (stopRequested) return;
        await checkPaused();
        playNote(node.note, node.duration);

        await checkPaused();
        await new Promise(r => setTimeout(r, node.duration * 1000 * quarter));

        node.svgElement.setAttribute("fill", "white");

        if (stopRequested) return;
        if (node.left) queue.push(node.left);
        if (node.right) queue.push(node.right);
    }
}



// setTimeout(() => preorderPlay(root), 1000); // start after 1 second
playPreorderBtn.addEventListener("click", () => {
    bpm=bpmRange.value;
    quarter=60/bpm;
    stopRequested = false;
    isPaused = false;
    preorderPlay(root);
});
playInorderBtn.addEventListener("click", () => {
    bpm=bpmRange.value;
    quarter=60/bpm;
    stopRequested = false;
    isPaused = false;
    inorderPlay(root);
});
playPostorderBtn.addEventListener("click", () => {
    bpm=bpmRange.value;
    quarter=60/bpm;
    stopRequested = false;
    isPaused = false;
    postorderPlay(root);
});
playBFSBtn.addEventListener("click", () => {
    bpm=bpmRange.value;
    quarter=60/bpm;
    stopRequested = false;
    isPaused = false;
    BFSPlay(root);
});

// load from file

// --- Sequence Input ---
const hpbdsong = [
{ note: "C4", duration: 0.5 },
{ note: "C4", duration: 0.5 },
{ note: "D4", duration: 1.0 },
{ note: "C4", duration: 1.0 },
{ note: "F4", duration: 1.0 },
{ note: "E4", duration: 2.0 },
{ note: "REST", duration: 1.0 },
{ note: "C4", duration: 0.5 },
{ note: "C4", duration: 0.5 },
{ note: "D4", duration: 1.0 },
{ note: "C4", duration: 1.0 },
{ note: "G4", duration: 1.0 },
{ note: "F4", duration: 2.0 },
{ note: "REST", duration: 1.0 },
{ note: "C4", duration: 0.5 },
{ note: "C4", duration: 0.5 },
{ note: "C5", duration: 1.0 },
{ note: "A4", duration: 1.0 },
{ note: "F4", duration: 1.0 },
{ note: "E4", duration: 1.0 },
{ note: "D4", duration: 2.0 },
{ note: "REST", duration: 1.0 },
{ note: "A#4", duration: 0.5 },
{ note: "A#4", duration: 0.5 },
{ note: "A4", duration: 1.0 },
{ note: "F4", duration: 1.0 },
{ note: "G4", duration: 1.0 },
{ note: "F4", duration: 2.0 },
];
const twinkleStar = [
{note: "C4", duration: 1.0},
{note: "C4", duration: 1.0},
{note: "G4", duration: 1.0},
{note: "G4", duration: 1.0},
{note: "A4", duration: 1.0},
{note: "A4", duration: 1.0},
{note: "G4", duration: 2.0},
{note: "REST", duration: 1.0},

{note: "F4", duration: 1.0},
{note: "F4", duration: 1.0},
{note: "E4", duration: 1.0},
{note: "E4", duration: 1.0},
{note: "D4", duration: 1.0},
{note: "D4", duration: 1.0},
{note: "C4", duration: 2.0},
{note: "REST", duration: 1.0},

{note: "G4", duration: 1.0},
{note: "G4", duration: 1.0},
{note: "F4", duration: 1.0},
{note: "F4", duration: 1.0},
{note: "E4", duration: 1.0},
{note: "E4", duration: 1.0},
{note: "D4", duration: 2.0},
{note: "REST", duration: 1.0},

{note: "G4", duration: 1.0},
{note: "G4", duration: 1.0},
{note: "F4", duration: 1.0},
{note: "F4", duration: 1.0},
{note: "E4", duration: 1.0},
{note: "E4", duration: 1.0},
{note: "D4", duration: 2.0},
{note: "REST", duration: 1.0},

{note: "C4", duration: 1.0},
{note: "C4", duration: 1.0},
{note: "G4", duration: 1.0},
{note: "G4", duration: 1.0},
{note: "A4", duration: 1.0},
{note: "A4", duration: 1.0},
{note: "G4", duration: 2.0},
{note: "REST", duration: 1.0},

{note: "F4", duration: 1.0},
{note: "F4", duration: 1.0},
{note: "E4", duration: 1.0},
{note: "E4", duration: 1.0},
{note: "D4", duration: 1.0},
{note: "D4", duration: 1.0},
{note: "C4", duration: 2.0},
{note: "REST", duration: 1.0},
];
const daisyBell = [
// Phrase 1: "Daisy, Daisy, give me your answer do"
{note: "G4", duration: 2.0},
{note: "E4", duration: 2.0},
{note: "C4", duration: 2.0},
{note: "G3", duration: 2.0},
{note: "A3", duration: 0.5},
{note: "B3", duration: 0.5},
{note: "C4", duration: 0.5},
{note: "A3", duration: 1.0},
{note: "C4", duration: 0.5},
{note: "G3", duration: 2.0},
{note: "REST", duration: 1.0},

// Phrase 2: "I'm half crazy all for the love of you"
{note: "D4", duration: 2.0},
{note: "G4", duration: 2.0},
{note: "E4", duration: 2.0},
{note: "C4", duration: 2.0},
{note: "A3", duration: 0.5},
{note: "B3", duration: 0.5},
{note: "C4", duration: 0.5},
{note: "D4", duration: 1.0},
{note: "E4", duration: 0.5},
{note: "D4", duration: 2.0},
{note: "REST", duration: 1.0},

// Phrase 3: "It won't be a stylish marriage"
{note: "E4", duration: 0.5},
{note: "F4", duration: 0.5},
{note: "E4", duration: 0.5},
{note: "D4", duration: 0.5},
{note: "G4", duration: 1.0},
{note: "E4", duration: 0.5},
{note: "D4", duration: 0.5},
{note: "C4", duration: 1.0},
{note: "REST", duration: 1.0},

// Phrase 4: "I can't afford a carriage"
{note: "D4", duration: 0.5},
{note: "E4", duration: 1.0},
{note: "C4", duration: 0.5},
{note: "A3", duration: 1.0},
{note: "C4", duration: 0.5},
{note: "A3", duration: 0.5},
{note: "G3", duration: 1.0},
{note: "REST", duration: 1.0},

// Phrase 5: "But you'll look sweet upon the seat"
{note: "G3", duration: 0.5},
{note: "C4", duration: 1.0},
{note: "E4", duration: 0.5},
{note: "D4", duration: 1.0},

{note: "G3", duration: 0.5},
{note: "C4", duration: 1.0},
{note: "E4", duration: 0.5},
{note: "D4", duration: 0.5},
{note: "E4", duration: 0.5},
{note: "F4", duration: 0.5},
{note: "G4", duration: 0.5},
{note: "E4", duration: 0.5},

{note: "C4", duration: 0.5},
{note: "D4", duration: 1.0},
{note: "G3", duration: 0.5},
{note: "C4", duration: 4.0},
];

let seqInput = [{ note: "C4", duration: 0.5 }];

drawSeqItems();

seqAppendBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    openSeqPopup(seqAppendBtn.getBoundingClientRect().right, seqAppendBtn.getBoundingClientRect().top);
})
seqPopupCancel.addEventListener("click", () => {
    seqPopup.style.display = "none";
    currentItem = null;
});
seqPopupApply.addEventListener("click", () => {
    seqInput.push({
        note: seqPopupNote.value + seqPopupOctave.value,
        duration: parseFloat(seqPopupDuration.value)
    });
    drawSeqItems();
});

function openSeqPopup(x, y) {
    closeAllPopups();
    seqPopup.style.display = "flex";
    positionPopup(seqPopup, x, y);

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

function drawSeqItems() {
    seqBar.innerHTML = "";
    for (const item of seqInput) {
        const temp = document.createElement("div");
        temp.setAttribute('style', 'white-space: pre;');
        temp.className = "seq_item";
        temp.textContent = `${item.note}\n(${item.duration})`;
        // Click listener for popup
        temp.addEventListener("click", (e) => {
            e.stopPropagation();
            openSeqEditPopup(item, e.clientX, e.clientY);
        });
        seqBar.appendChild(temp);
    }
}




// --- Sequence Input Edit ---
let currentItem = null;

function openSeqEditPopup(item, x, y) {
    closeAllPopups();
    currentItem = item; // Set to the clicked item
    seqEditPopup.style.display = "flex";
    positionPopup(seqEditPopup, x, y);

    // Parse node.note (e.g., "C4")
    const match = item.note.match(/^([A-G]#?)(\d)$/);
    if (match) {
        seqEditPopupNote.value = match[1];
        seqEditPopupOctave.value = match[2];
    } else {
        seqEditPopupNote.value = "R";
        seqEditPopupOctave.value = 4;
    }
    seqEditPopupDuration.value = item.duration;
}


seqEditPopupCancel.addEventListener("click", () => {
    seqEditPopup.style.display = "none";
    currentItem = null;
});
seqEditPopupApply.addEventListener("click", () => {
    // Update the seqInput and the display
    if (!currentItem) return;
    const note = seqEditPopupNote.value + seqEditPopupOctave.value;
    const duration = parseFloat(seqEditPopupDuration.value);
    currentItem.note = note;
    currentItem.duration = duration;
    seqEditPopup.style.display = "none";
    currentItem = null;
    drawSeqItems();
});
seqEditPopupDelete.addEventListener("click", () => {
    // Delete from seqInput and the display
    if (!currentItem) return;
    // Only delete if leaf
    function deleteItem(currenItem) {   
        const index = seqInput.indexOf(currenItem);
        if (index !== -1) {
            seqInput.splice(index, 1);
        }
    }
    deleteItem(currentItem);

    seqBar.innerHTML = ""; // Clear SVG
    drawSeqItems(); // Redraw
    seqEditPopup.style.display = "none";
    currentItem = null;
});


const seqPreorderBtn = document.getElementById("seq_preorder");
const seqInorderBtn = document.getElementById("seq_inorder");
const seqPostorderBtn = document.getElementById("seq_postorder");
const seqBFSBtn = document.getElementById("seq_BFS");

seqPreorderBtn.addEventListener("click", () => {
    if (seqInput.length === 0) return;

    // 1. Build a new balanced tree from seqInput preorder
    const newRoot = buildBalancedTreeFromPreorder(seqInput);

    // 2. Replace the old root
    root.left = root.right = null; // clear old tree
    Object.assign(root, newRoot);  // copy new tree into root

    // 3. Redraw
    svg.innerHTML = "";
    drawTree(root);
});
seqInorderBtn.addEventListener("click", () => {
    if (seqInput.length === 0) return;
    // 1. Build a new balanced tree from seqInput preorder
    const newRoot = buildBalancedTreeFromInorder(seqInput);
    // 2. Replace the old root
    root.left = root.right = null; // clear old tree
    Object.assign(root, newRoot);  // copy new tree into root
    // 3. Redraw
    svg.innerHTML = "";
    drawTree(root);
});
seqPostorderBtn.addEventListener("click", () => {
    if (seqInput.length === 0) return;
    // 1. Build a new balanced tree from seqInput preorder
    const newRoot = buildBalancedTreeFromPostorder(seqInput);
    // 2. Replace the old root
    root.left = root.right = null; // clear old tree
    Object.assign(root, newRoot);  // copy new tree into root
    // 3. Redraw
    svg.innerHTML = "";
    drawTree(root);
});
seqBFSBtn.addEventListener("click", () => {
    if (seqInput.length === 0) return;
    // 1. Build a new balanced tree from seqInput preorder
    const newRoot = buildTreeFromBFS(seqInput);
    // 2. Replace the old root
    root.left = root.right = null; // clear old tree
    Object.assign(root, newRoot);  // copy new tree into root
    // 3. Redraw
    svg.innerHTML = "";
    drawTree(root);
});

function buildBalancedTreeFromPreorder(arr) {
    if (arr.length === 0) return null;
    // First element is always the root (required by preorder)
    const { note, duration } = arr[0];
    const root = new Node(note, duration);

    if (arr.length === 1) return root;
    // Split remaining elements as evenly as possible
    const rest = arr.slice(1);
    const mid = Math.floor(rest.length / 2);

    const leftArr = rest.slice(0, mid);
    const rightArr = rest.slice(mid);

    root.left = buildBalancedTreeFromPreorder(leftArr);
    root.right = buildBalancedTreeFromPreorder(rightArr);

    return root;
}

function buildBalancedTreeFromInorder(arr) {
    if (arr.length === 0) return null;

    const mid = Math.floor(arr.length / 2);
    const { note, duration } = arr[mid];
    const root = new Node(note, duration);

    const leftArr = arr.slice(0, mid);
    const rightArr = arr.slice(mid + 1);

    root.left = buildBalancedTreeFromInorder(leftArr);
    root.right = buildBalancedTreeFromInorder(rightArr);

    return root;
}

function buildBalancedTreeFromPostorder(arr) {
    if (arr.length === 0) return null;

    // Root is last element in postorder
    const { note, duration } = arr[arr.length - 1];
    const root = new Node(note, duration);

    if (arr.length === 1) return root;

    const rest = arr.slice(0, arr.length - 1);
    const mid = Math.floor(rest.length / 2);

    const leftArr = rest.slice(0, mid);
    const rightArr = rest.slice(mid);

    root.left = buildBalancedTreeFromPostorder(leftArr);
    root.right = buildBalancedTreeFromPostorder(rightArr);

    return root;
}

function buildTreeFromBFS(arr) {
    if (arr.length === 0) return null;

    // Create Node objects
    const nodes = arr.map(item => new Node(item.note, item.duration));

    // Link children (complete binary tree structure)
    for (let i = 0; i < nodes.length; i++) {
        let leftIndex = 2 * i + 1;
        let rightIndex = 2 * i + 2;

        if (leftIndex < nodes.length) {
            nodes[i].left = nodes[leftIndex];
        }
        if (rightIndex < nodes.length) {
            nodes[i].right = nodes[rightIndex];
        }
    }
    return nodes[0]; // root
}


stopBtn.addEventListener("click", () => {
    stopRequested = true;
});
pauseBtn.addEventListener("click", () => {
    if (isPaused) return;  // already paused
    isPaused = true;

    // create a promise that traversal will wait on
    pausePromise = new Promise(resolve => {
        resume = resolve;   // store resolver for resume
    });
});
resumeBtn.addEventListener("click", () => {
    if (!isPaused) return;

    isPaused = false;
    resume();      // continue traversal
    pausePromise = null;
});

async function checkPaused() {
    while (isPaused) {
        await pausePromise;   // wait until RESUME
    }
}

const hpbdbtn = document.getElementById("hpbdsong");
const twinklebtn = document.getElementById("twinkle_star");
const daisybtn = document.getElementById("daisy_bell");

hpbdbtn.addEventListener("click", () => {
    seqInput.length = 0;
    Array.prototype.push.apply(seqInput, hpbdsong);
    drawSeqItems();
});
twinklebtn.addEventListener("click", () => {
    seqInput.length = 0;
    Array.prototype.push.apply(seqInput, twinkleStar);
    drawSeqItems();
});
daisybtn.addEventListener("click", () => {
    seqInput.length = 0;
    Array.prototype.push.apply(seqInput, daisyBell);
    console.log(seqInput);
    drawSeqItems();
});

const introBtn = document.getElementById("intro_btn");
const introPopup = document.getElementById("introduction_popup");
const introPopupClose = document.getElementById("introduction_popup_close");

introBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    openIntroPopup();
});
introPopupClose.addEventListener("click", () => {
    introPopup.style.display = "none";
});

function openIntroPopup() {
    closeAllPopups();
    introPopup.style.display = "flex";
}

const helpBtn = document.getElementById("help_btn");
const helpPopup = document.getElementById("help_popup");
const helpPopupClose = document.getElementById("help_popup_close");

helpBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    openHelpPopup();
});
helpPopupClose.addEventListener("click", () => {
    helpPopup.style.display = "none";
});

function openHelpPopup() {
    closeAllPopups();
    helpPopup.style.display = "flex";
}

