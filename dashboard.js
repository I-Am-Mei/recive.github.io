// --- Supabase client setup ---
const SUPABASE_URL = "https://lrmfhusbakkgpjjdjdvg.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxybWZodXNiYWtrZ3BqamRqZHZnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTUyOTQzNTUsImV4cCI6MjA3MDg3MDM1NX0.bY9ILZaTNELGjRvu7ovcKA2moqnOhAb_8oN2QhIigPg"; 
const client = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// --- Session check ---
const session = JSON.parse(localStorage.getItem('session'));
if (!session) window.location.href = 'index.html';
const user = session.user;

// --- Hide/Show sections based on user role ---
document.addEventListener('DOMContentLoaded', function() {
  const createTaskSection = document.getElementById('create-task-section');
  const createUserSection = document.getElementById('create-user-section');
  const timeoffSection = document.getElementById('timeoff-section');

  // Hide task creation unless Head
  if (user.role !== "Head") {
    createTaskSection?.classList.add("hidden");
    createUserSection?.classList.add("hidden");
  } else {
    createTaskSection?.classList.remove("hidden");
    createUserSection?.classList.remove("hidden");
  }

  // Show time off section for everyone
  if (timeoffSection) {
    timeoffSection.classList.remove("hidden");
  }
});

// --- Create Task (Heads only) ---
document.getElementById('create-task-btn')?.addEventListener('click', async () => {
  if (user.role !== "Head") return; // double safety

  const title = document.getElementById('task-title').value.trim();
  const desc = document.getElementById('task-desc').value.trim();
  const role = document.getElementById('task-role').value;

  if (!title || !desc || !role) return showTaskMsg("Title, description & role required!", true);

  try {
    const { error } = await client.from('tasks').insert([{
      title,
      description: desc,
      status: 'unassigned',
      assigned_to: null,
      role, // link task to department
      created_at: new Date()
    }]);

    if (error) {
      showTaskMsg("Error: " + error.message, true);
    } else {
      showTaskMsg("Task created!", false);
      document.getElementById('task-title').value = "";
      document.getElementById('task-desc').value = "";
      document.getElementById('task-role').value = "";
      loadDashboard();
    }
  } catch (err) {
    console.error('Task creation error:', err);
    showTaskMsg("Failed to create task", true);
  }
});

// --- Create User (Heads only) ---
document.getElementById('create-user-btn')?.addEventListener('click', async () => {
  if (user.role !== "Head") return;

  const username = document.getElementById('new-username').value.trim();
  const password = document.getElementById('new-password') ? document.getElementById('new-password').value.trim() : 'password123';
  const role = document.getElementById('new-role').value;
  const level = document.getElementById('new-level') ? document.getElementById('new-level').value : 'Junior';

  if (!username || !role) {
    showCreateMsg("Username and role required!", true);
    return;
  }

  try {
    const { error } = await client.from('user').insert([{
      username,
      password,
      role,
      level
    }]);

    if (error) {
      showCreateMsg("Error: " + error.message, true);
    } else {
      showCreateMsg("User created!", false);
      document.getElementById('new-username').value = "";
      if (document.getElementById('new-password')) document.getElementById('new-password').value = "";
      loadDashboard();
    }
  } catch (err) {
    console.error('User creation error:', err);
    showCreateMsg("Failed to create user", true);
  }
});

// --- Time Off Request ---
document.getElementById('request-timeoff-btn')?.addEventListener('click', async () => {
  const startDate = document.getElementById('timeoff-start').value;
  const endDate = document.getElementById('timeoff-end').value;
  const reason = document.getElementById('timeoff-reason') ? document.getElementById('timeoff-reason').value.trim() : 'Personal time off';

  if (!startDate || !endDate) {
    showTimeOffMsg("Start and end dates required!", true);
    return;
  }

  if (new Date(startDate) > new Date(endDate)) {
    showTimeOffMsg("End date must be after start date!", true);
    return;
  }

  try {
    const { error } = await client.from('time_off_requests').insert([{
      user_id: user.id,
      start_date: startDate,
      end_date: endDate,
      reason: reason || 'Personal time off',
      status: 'pending',
      requested_at: new Date()
    }]);

    if (error) {
      showTimeOffMsg("Error: " + error.message, true);
    } else {
      showTimeOffMsg("Time off request submitted!", false);
      document.getElementById('timeoff-start').value = "";
      document.getElementById('timeoff-end').value = "";
      if (document.getElementById('timeoff-reason')) document.getElementById('timeoff-reason').value = "";
      loadDashboard(); // Refresh to show updated requests for heads
    }
  } catch (err) {
    console.error('Time off request error:', err);
    showTimeOffMsg("Failed to submit request", true);
  }
});

// --- Message Display Functions ---
function showTaskMsg(msg, isError) {
  const el = document.getElementById('task-msg');
  if (!el) return;
  el.textContent = msg;
  el.classList.remove('hidden', 'text-green-500', 'text-red-500');
  el.classList.add(isError ? 'text-red-500' : 'text-green-500');
  setTimeout(() => el.classList.add('hidden'), 3000);
}

function showCreateMsg(msg, isError) {
  const successEl = document.getElementById('create-success');
  const errorEl = document.getElementById('create-error');
  
  if (successEl) successEl.classList.add('hidden');
  if (errorEl) errorEl.classList.add('hidden');
  
  if (isError && errorEl) {
    errorEl.textContent = msg;
    errorEl.classList.remove('hidden');
  } else if (!isError && successEl) {
    successEl.textContent = msg;
    successEl.classList.remove('hidden');
  }
  
  setTimeout(() => {
    if (successEl) successEl.classList.add('hidden');
    if (errorEl) errorEl.classList.add('hidden');
  }, 3000);
}

function showTimeOffMsg(msg, isError) {
  const el = document.getElementById('timeoff-msg');
  if (!el) return;
  el.textContent = msg;
  el.classList.remove('hidden', 'text-green-500', 'text-red-500');
  el.classList.add(isError ? 'text-red-500' : 'text-green-500');
  setTimeout(() => el.classList.add('hidden'), 3000);
}

// --- Load Dashboard ---
async function loadDashboard() {
  try {
    const { data: users, error: userErr } = await client.from('user').select('*');
    const { data: tasks, error: taskErr } = await client.from('tasks').select('*');

    const dashboard = document.getElementById('dashboard-content');
    if (!dashboard) return;
    
    dashboard.innerHTML = "";

    if (userErr || taskErr) {
      dashboard.innerHTML = `<p class="text-red-500">Error loading data: ${userErr?.message || taskErr?.message}</p>`;
      return;
    }

    let visibleUsers = [];
    let visibleTasks = [];

    if (user.role === "Head") {
      visibleUsers = users || [];
      visibleTasks = tasks || [];
      
      // Load time off requests for heads
      await loadTimeOffRequests(dashboard);
    } else if (user.level === "Lead") {
      visibleUsers = users ? users.filter(u => u.role === user.role) : [];
      visibleTasks = tasks ? tasks.filter(t => t.role === user.role) : [];
    } else {
      // Regular workers see themselves and ALL tasks assigned to them OR tasks for their role
      visibleUsers = users ? users.filter(u => u.id === user.id) : [];
      visibleTasks = tasks ? tasks.filter(t => t.assigned_to === user.id || t.role === user.role) : [];
    }

    // --- People Section ---
    const peopleSection = document.createElement('div');
    peopleSection.classList.add('mb-6', 'bg-white', 'shadow-md', 'rounded', 'px-6', 'pt-4', 'pb-6');
    peopleSection.innerHTML = `<h2 class="text-xl font-semibold mb-2">People</h2>`;
    const uList = document.createElement('ul');
    visibleUsers.forEach(u => {
      const li = document.createElement('li');
      li.className = 'mb-2 p-2 bg-gray-50 rounded';
      li.textContent = `${u.username} (${u.level || 'Worker'} ${u.role})`;
      uList.appendChild(li);
    });
    peopleSection.appendChild(uList);
    dashboard.appendChild(peopleSection);

    // --- Tasks Section ---
    const tasksSection = document.createElement('div');
    tasksSection.classList.add('mb-6', 'bg-white', 'shadow-md', 'rounded', 'px-6', 'pt-4', 'pb-6');
    tasksSection.innerHTML = `<h2 class="text-xl font-semibold mb-2">Tasks</h2>`;
    const tList = document.createElement('ul');

    if (visibleTasks.length === 0) {
      const li = document.createElement('li');
      li.textContent = "No tasks found.";
      li.className = 'text-gray-500 italic';
      tList.appendChild(li);
    } else {
      visibleTasks.forEach(t => {
        const li = document.createElement('li');
        li.className = 'mb-3 p-3 bg-gray-50 rounded border';
        
        const assignedUser = t.assigned_to ? users.find(u => u.id === t.assigned_to) : null;
        const assignedText = assignedUser ? assignedUser.username : 'Unassigned';
        
        li.innerHTML = `
          <div class="mb-2">
            <strong>${t.title}</strong>
            <span class="ml-2 px-2 py-1 text-xs rounded ${t.status === 'assigned' ? 'bg-blue-100 text-blue-800' : t.status === 'completed' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}">${t.status}</span>
          </div>
          <p class="text-gray-600 text-sm mb-2">${t.description}</p>
          <p class="text-xs text-gray-500">Department: ${t.role} | Assigned to: ${assignedText}</p>
        `;

        // Add action buttons container
        const actionsDiv = document.createElement('div');
        actionsDiv.className = 'mt-2 flex flex-wrap gap-2';

        // Head can directly claim unassigned tasks
        if (!t.assigned_to && user.role === "Head") {
          const btn = document.createElement('button');
          btn.textContent = "Claim Task";
          btn.className = "bg-green-500 hover:bg-green-700 text-white py-1 px-2 rounded text-xs";
          btn.onclick = () => claimTask(t.id);
          actionsDiv.appendChild(btn);
        }

        // Workers can claim unassigned tasks in their department or mark assigned tasks as complete
        if (user.role !== "Head" && user.level !== "Lead") {
          if (!t.assigned_to && t.role === user.role) {
            // Can claim unassigned tasks in their department
            const claimBtn = document.createElement('button');
            claimBtn.textContent = "Claim Task";
            claimBtn.className = "bg-green-500 hover:bg-green-700 text-white py-1 px-2 rounded text-xs";
            claimBtn.onclick = () => claimTask(t.id);
            actionsDiv.appendChild(claimBtn);
          } else if (t.assigned_to === user.id && t.status === 'assigned') {
            // Can mark their assigned tasks as complete
            const completeBtn = document.createElement('button');
            completeBtn.textContent = "Mark Complete";
            completeBtn.className = "bg-purple-500 hover:bg-purple-700 text-white py-1 px-2 rounded text-xs";
            completeBtn.onclick = () => completeTask(t.id);
            actionsDiv.appendChild(completeBtn);
          }
        }

        // Leads can distribute tasks in their department
        if (!t.assigned_to && user.level === "Lead" && t.role === user.role) {
          const juniorsBtn = document.createElement('button');
          juniorsBtn.textContent = "Assign to Juniors";
          juniorsBtn.className = "bg-blue-500 hover:bg-blue-700 text-white py-1 px-2 rounded text-xs";
          juniorsBtn.onclick = () => assignTaskToLevel(t.id, "Junior", user.role, users);

          const seniorsBtn = document.createElement('button');
          seniorsBtn.textContent = "Assign to Seniors";
          seniorsBtn.className = "bg-indigo-500 hover:bg-indigo-700 text-white py-1 px-2 rounded text-xs";
          seniorsBtn.onclick = () => assignTaskToLevel(t.id, "Senior", user.role, users);

          const myselfBtn = document.createElement('button');
          myselfBtn.textContent = "Take Myself";
          myselfBtn.className = "bg-green-500 hover:bg-green-700 text-white py-1 px-2 rounded text-xs";
          myselfBtn.onclick = () => claimTask(t.id);

          actionsDiv.appendChild(juniorsBtn);
          actionsDiv.appendChild(seniorsBtn);
          actionsDiv.appendChild(myselfBtn);
        }

        // Only add actions div if it has buttons
        if (actionsDiv.children.length > 0) {
          li.appendChild(actionsDiv);
        }

        tList.appendChild(li);
      });
    }

    tasksSection.appendChild(tList);
    dashboard.appendChild(tasksSection);
  } catch (err) {
    console.error('Dashboard loading error:', err);
    const dashboard = document.getElementById('dashboard-content');
    if (dashboard) {
      dashboard.innerHTML = `<p class="text-red-500">Error loading dashboard data</p>`;
    }
  }
}

// --- Load Time Off Requests (for Heads) ---
async function loadTimeOffRequests(dashboard) {
  try {
    const { data: requests, error } = await client
      .from('time_off_requests')
      .select(`
        *,
        user:user_id (username, role, level)
      `)
      .order('requested_at', { ascending: false });

    if (!error && requests && requests.length > 0) {
      const requestsSection = document.createElement('div');
      requestsSection.classList.add('mb-6', 'bg-white', 'shadow-md', 'rounded', 'px-6', 'pt-4', 'pb-6');
      requestsSection.innerHTML = `<h2 class="text-xl font-semibold mb-2">Time Off Requests</h2>`;
      
      const requestsList = document.createElement('div');
      requests.forEach(req => {
        const reqDiv = document.createElement('div');
        reqDiv.className = 'mb-3 p-3 bg-gray-50 rounded border';
        
        const statusClass = req.status === 'approved' ? 'bg-green-100 text-green-800' : 
                           req.status === 'rejected' ? 'bg-red-100 text-red-800' : 
                           'bg-yellow-100 text-yellow-800';
        
        reqDiv.innerHTML = `
          <div class="flex justify-between items-start">
            <div>
              <strong>${req.user?.username || 'Unknown User'}</strong>
              <span class="ml-2 px-2 py-1 text-xs rounded ${statusClass}">${req.status}</span>
              <p class="text-sm text-gray-600 mt-1">${req.start_date} to ${req.end_date}</p>
              <p class="text-sm text-gray-500">Reason: ${req.reason}</p>
            </div>
            <div class="flex space-x-2">
              ${req.status === 'pending' ? `
                <button onclick="approveTimeOff(${req.id})" class="bg-green-500 hover:bg-green-700 text-white py-1 px-2 rounded text-xs">Approve</button>
                <button onclick="rejectTimeOff(${req.id})" class="bg-red-500 hover:bg-red-700 text-white py-1 px-2 rounded text-xs">Reject</button>
              ` : ''}
            </div>
          </div>
        `;
        requestsList.appendChild(reqDiv);
      });
      
      requestsSection.appendChild(requestsList);
      dashboard.appendChild(requestsSection);
    }
  } catch (err) {
    console.error('Time off requests loading error:', err);
  }
}

// --- Time Off Approval Functions ---
async function approveTimeOff(requestId) {
  try {
    const { error } = await client
      .from('time_off_requests')
      .update({ status: 'approved' })
      .eq('id', requestId);
    
    if (!error) {
      loadDashboard();
    } else {
      alert('Error approving request: ' + error.message);
    }
  } catch (err) {
    console.error('Approve error:', err);
    alert('Failed to approve request');
  }
}

async function rejectTimeOff(requestId) {
  try {
    const { error } = await client
      .from('time_off_requests')
      .update({ status: 'rejected' })
      .eq('id', requestId);
    
    if (!error) {
      loadDashboard();
    } else {
      alert('Error rejecting request: ' + error.message);
    }
  } catch (err) {
    console.error('Reject error:', err);
    alert('Failed to reject request');
  }
}

// Make functions globally available
window.approveTimeOff = approveTimeOff;
window.rejectTimeOff = rejectTimeOff;

// --- Complete Task ---
async function completeTask(taskId) {
  try {
    const { error } = await client
      .from('tasks')
      .update({ status: 'completed' })
      .eq('id', taskId);

    if (!error) {
      loadDashboard();
    } else {
      alert('Error completing task: ' + error.message);
    }
  } catch (err) {
    console.error('Complete task error:', err);
    alert('Failed to complete task');
  }
}

// --- Claim Task ---
async function claimTask(taskId) {
  try {
    const { error } = await client
      .from('tasks')
      .update({ assigned_to: user.id, status: 'assigned' })
      .eq('id', taskId);

    if (!error) {
      loadDashboard();
    } else {
      alert('Error claiming task: ' + error.message);
    }
  } catch (err) {
    console.error('Claim task error:', err);
    alert('Failed to claim task');
  }
}

// --- Assign Task to Juniors or Seniors ---
async function assignTaskToLevel(taskId, level, role, users) {
  const eligibleUsers = users ? users.filter(u => u.role === role && u.level === level) : [];

  if (!eligibleUsers || eligibleUsers.length === 0) {
    alert(`No ${level} ${role}s found`);
    return;
  }

  // For now, assign task to the first user found in that level+role
  const targetUser = eligibleUsers[0];

  try {
    const { error } = await client.from('tasks').update({
      assigned_to: targetUser.id,
      status: "assigned"
    }).eq('id', taskId);

    if (!error) {
      loadDashboard();
    } else {
      alert('Error assigning task: ' + error.message);
    }
  } catch (err) {
    console.error('Assign task error:', err);
    alert('Failed to assign task');
  }
}

// --- Logout ---
const logoutBtn = document.getElementById('logout');
if (logoutBtn) {
  logoutBtn.addEventListener('click', () => {
    localStorage.removeItem('session');
    window.location.href = 'index.html';
  });
}

// --- Initial load ---
document.addEventListener('DOMContentLoaded', function() {
  loadDashboard();
});
