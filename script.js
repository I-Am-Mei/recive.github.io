// --- Supabase Setup ---
src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js"
const SUPABASE_URL = "https://lrmfhusbakkgpjjdjdvg.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxybWZodXNiYWtrZ3BqamRqZHZnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTUyOTQzNTUsImV4cCI6MjA3MDg3MDM1NX0.bY9ILZaTNELGjRvu7ovcKA2moqnOhAb_8oN2QhIigPg";

const supabase = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// --- LOCAL VARIABLES ---
let currentUser = null;

// Utility: random password
function generatePassword(length = 8) {
    const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    return Array.from({length}, () => chars[Math.floor(Math.random()*chars.length)]).join('');
}

// --- LOGIN ---
async function handleLogin() {
    const username = document.getElementById('loginUsername').value.trim();
    const password = document.getElementById('loginPassword').value.trim();

    const { data: users, error } = await supabase
        .from('users')
        .select('*')
        .eq('username', username)
        .eq('password', password)
        .limit(1);

    if(error || users.length === 0) { alert("Invalid login!"); return; }

    currentUser = users[0];

    document.getElementById('loginPanel').style.display = 'none';

    if(currentUser.role.toLowerCase() === 'head') {
        document.getElementById('headPanel').style.display = 'block';
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
async function renderMembers() {
    const { data: members, error } = await supabase.from('members').select('*');
    const activeDiv = document.getElementById('activeMembers');
    const assignSelect = document.getElementById('assignTo');
    if(!activeDiv || !assignSelect) return;

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

async function addMember() {
    if(currentUser.role.toLowerCase() !== 'head') { alert("Only Head can add members."); return; }

    const name = document.getElementById('newName').value.trim();
    const role = document.getElementById('newRole').value;
    if(!name) { alert('Please enter a name'); return; }

    const username = name.toLowerCase().replace(/\s+/g,'') + Date.now();
    const password = generatePassword();

    const member = {name, role, username, inactive: false};
    const user = {username, password, role: "Member", name};

    await supabase.from('members').insert([member]);
    await supabase.from('users').insert([user]);

    document.getElementById('newName').value = '';
    renderMembers();
    renderCredentials();
}

async function removeMember(username) {
    if(currentUser.role.toLowerCase() !== 'head') { alert("Only Head can remove members."); return; }
    if(confirm('Remove this member?')) {
        await supabase.from('members').delete().eq('username', username);
        await supabase.from('users').delete().eq('username', username);
        renderMembers();
        renderCredentials();
    }
}

// --- TASKS ---
async function renderTasks() {
    const { data: tasks } = await supabase.from('tasks').select('*');
    const taskDiv = document.getElementById('workerTasks');
    if(!taskDiv || !currentUser) return;
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

async function assignTask() {
    const title = document.getElementById('taskTitle').value.trim();
    const description = document.getElementById('taskDescription').value.trim();
    const assignedTo = document.getElementById('assignTo').value;

    if(!title || !assignedTo) { alert("Please fill task details."); return; }

    await supabase.from('tasks').insert([{title, description, assignedTo, status: "Pending"}]);

    document.getElementById('taskTitle').value = '';
    document.getElementById('taskDescription').value = '';
    
    renderTasks();
}

// --- TIME OFFS ---
async function renderTimeOffs() {
    const { data: timeOffs } = await supabase.from('timeoffs').select('*');
    const timeOffDiv = document.getElementById('timeOffRequests');
    if(!timeOffDiv) return;
    timeOffDiv.innerHTML = '';

    const relevantRequests = currentUser.role.toLowerCase() === 'head' 
        ? timeOffs 
        : timeOffs.filter(t => t.username === currentUser.username);

    if(relevantRequests.length === 0) {
        timeOffDiv.textContent = 'No time-off requests.';
        return;
    }

    relevantRequests.forEach(t => {
        const card = document.createElement('div');
        card.className = 'card';
        card.innerHTML = `<strong>${t.name}</strong><br>From: ${t.startDate} To: ${t.endDate}<br>Status: ${t.status}`;
        if(currentUser.role.toLowerCase() === 'head' && t.status === 'Pending') {
            card.innerHTML += `<br>
                <button onclick="updateTimeOff('${t.username}', '${t.startDate}', 'Approved')">Approve</button>
                <button onclick="updateTimeOff('${t.username}', '${t.startDate}', 'Denied')">Deny</button>`;
        }
        timeOffDiv.appendChild(card);
    });
}

async function requestTimeOff() {
    const startDate = document.getElementById('timeOffStart').value;
    const endDate = document.getElementById('timeOffEnd').value;

    if(!startDate || !endDate) { alert("Please select dates."); return; }

    await supabase.from('timeoffs').insert([{username: currentUser.username, name: currentUser.name, startDate, endDate, status: "Pending"}]);

    renderTimeOffs();
}

async function updateTimeOff(username, startDate, status) {
    await supabase.from('timeoffs')
        .update({status})
        .eq('username', username)
        .eq('startDate', startDate);

    renderTimeOffs();
}

// --- CREDENTIALS DISPLAY ---
async function renderCredentials() {
    if(currentUser.role.toLowerCase() !== 'head') return;
    const { data: users } = await supabase.from('users').select('*');
    const credDiv = document.getElementById('credentialsList');
    if(!credDiv) return;
    credDiv.innerHTML = '';
    users.forEach(u => {
        const p = document.createElement('p');
        p.textContent = `Name: ${u.name}, Username: ${u.username}, Password: ${u.password}`;
        credDiv.appendChild(p);
    });
}
