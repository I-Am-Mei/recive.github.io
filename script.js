// Load from localStorage
let users = JSON.parse(localStorage.getItem('users') || '[]');
let members = JSON.parse(localStorage.getItem('members') || '[]');
let tasks = JSON.parse(localStorage.getItem('tasks') || '[]');
let timeOffs = JSON.parse(localStorage.getItem('timeOffs') || '[]');

let currentUser = null;

// Utility: random password
function generatePassword(length = 8) {
    const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    return Array.from({length}, () => chars[Math.floor(Math.random()*chars.length)]).join('');
}

// LOGIN (for testing purposes, you can set a default user)
function login(username, password) {
    currentUser = users.find(u => u.username === username && u.password === password);
    if(!currentUser) { alert("Invalid login!"); return; }

    if(currentUser.role.toLowerCase() === 'head') {
        document.getElementById('headPanel').style.display = 'block';
        document.getElementById('credentialsList').style.display = 'block';
        renderCredentials();
    } else {
        document.getElementById('workerPanel').style.display = 'block';
        document.getElementById('workerWelcome').textContent = `Welcome, ${currentUser.name}!`;
    }

    renderMembers();
    renderTasks();
    renderTimeOffs();
}

// --- MEMBERS ---
function renderMembers() {
    const activeDiv = document.getElementById('activeMembers');
    const assignSelect = document.getElementById('assignTo');
    activeDiv.innerHTML = '';
    assignSelect.innerHTML = '';

    members.forEach(m => {
        const card = document.createElement('div'); 
        card.className='card';
        card.innerHTML = `<strong>${m.name}</strong> <br> Role: ${m.role}`;
        if(currentUser.role.toLowerCase() === 'head'){
            card.innerHTML += `<br><button onclick="removeMember('${m.username}')">Remove</button>`;
        }
        activeDiv.appendChild(card);

        const option = document.createElement('option');
        option.value = m.username;
        option.textContent = m.name;
        assignSelect.appendChild(option);
    });
}

function addMember() {
    if(currentUser.role.toLowerCase() !== 'head') { alert("Only Head can add members."); return; }

    const name = document.getElementById('newName').value.trim();
    const role = document.getElementById('newRole').value;
    if(!name) { alert('Please enter a name'); return; }

    const username = name.toLowerCase().replace(/\s+/g,'') + Date.now();
    const password = generatePassword();

    const member = {name, role, username, inactive: false};
    members.push(member);

    const user = {username, password, role: "Member", name};
    users.push(user);

    localStorage.setItem('members', JSON.stringify(members));
    localStorage.setItem('users', JSON.stringify(users));
    
    document.getElementById('newName').value = '';
    renderMembers();
    renderCredentials();
}

function removeMember(username) {
    if(currentUser.role.toLowerCase() !== 'head') { alert("Only Head can remove members."); return; }
    if(confirm('Remove this member?')) {
        members = members.filter(m => m.username !== username);
        users = users.filter(u => u.username !== username);
        localStorage.setItem('members', JSON.stringify(members));
        localStorage.setItem('users', JSON.stringify(users));
        renderMembers();
        renderCredentials();
    }
}

// --- TASKS ---
function renderTasks() {
    const taskDiv = document.getElementById('workerTasks');
    if(!taskDiv) return;
    taskDiv.innerHTML = '';
    const myTasks = tasks.filter(t => t.assignedTo === currentUser.username);
    if(myTasks.length === 0) {
        taskDiv.textContent = 'No tasks assigned.';
        return;
    }
    myTasks.forEach(t => {
        const card = document.createElement('div');
        card.className = 'card';
        card.innerHTML = `<strong>${t.title}</strong><br>${t.description}<br>Status: ${t.status}`;
        taskDiv.appendChild(card);
    });
}

function assignTask() {
    const title = document.getElementById('taskTitle').value.trim();
    const description = document.getElementById('taskDescription').value.trim();
    const assignedTo = document.getElementById('assignTo').value;

    if(!title || !assignedTo) { alert("Please fill task details."); return; }

    tasks.push({title, description, assignedTo, status: "Pending"});
    localStorage.setItem('tasks', JSON.stringify(tasks));

    document.getElementById('taskTitle').value = '';
    document.getElementById('taskDescription').value = '';
    renderTasks();
}

// --- TIME OFF ---
function renderTimeOffs() {
    const timeDiv = document.getElementById('myTimeOffs');
    if(!timeDiv) return;
    timeDiv.innerHTML = '';
    const myTimeOffs = timeOffs.filter(to => to.username === currentUser.username);
    if(myTimeOffs.length === 0) {
        timeDiv.textContent = 'No time off requests.';
        return;
    }
    myTimeOffs.forEach(to => {
        const card = document.createElement('div');
        card.className = 'card';
        card.textContent = `Date: ${to.date}, Reason: ${to.reason}, Status: ${to.status}`;
        timeDiv.appendChild(card);
    });
}

function requestTimeOff() {
   
