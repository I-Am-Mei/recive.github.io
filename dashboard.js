const SUPABASE_URL = "https://lrmfhusbakkgpjjdjdvg.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxybWZodXNiYWtrZ3BqamRqZHZnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTUyOTQzNTUsImV4cCI6MjA3MDg3MDM1NX0.bY9ILZaTNELGjRvu7ovcKA2moqnOhAb_8oN2QhIigPg";
const client = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const session = JSON.parse(localStorage.getItem('session'));
if (!session) window.location.href = 'index.html';
const user = session.user;

// Generate random password
function generatePassword(length = 12) {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()";
  return Array.from({ length }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

// Load dashboard
async function loadDashboard() {
  const { data: users } = await client.from('user').select('*');
  const { data: tasks } = await client.from('tasks').select('*');
  const { data: timeOff } = await client.from('time_off_requests').select('*');

  const dashboard = document.getElementById('dashboard-content');
  dashboard.innerHTML = ""; // Clear previous content

  // HEAD & LEAD view
  if (['Head', 'Lead'].includes(user.role)) {

    // Create User Section only for Head
    if (user.role === 'Head') {
      document.getElementById('create-user-section').classList.remove('hidden');
    }

    // Filter visible users for Leads
    const visibleUsers = user.role === 'Lead'
      ? users.filter(u => u.team_id === user.team_id)
      : users;

    // Group by role/department
    const groupedByRole = {};
    visibleUsers.forEach(u => {
      if (!groupedByRole[u.role]) groupedByRole[u.role] = [];
      groupedByRole[u.role].push(u);
    });

    // Display each role in collapsible sections
    for (const role in groupedByRole) {
      const section = document.createElement('div');
      section.classList.add('mb-4');
      section.innerHTML = `
        <button class="role-toggle w-full text-left bg-gray-200 px-2 py-1 rounded">${role}</button>
        <ul class="role-users hidden list-disc pl-6 mt-2"></ul>
      `;
      const list = section.querySelector('.role-users');

      // Sort: Head -> Lead -> Senior -> Junior
      const sortedUsers = groupedByRole[role].sort((a, b) => {
        const order = ['Head', 'Lead', 'Senior', 'Junior'];
        return order.indexOf(a.level) - order.indexOf(b.level);
      });

      sortedUsers.forEach(u => {
        const li = document.createElement('li');
        li.innerHTML = `${u.username} - Password: ${u.password} 
          ${['Head', 'Lead'].includes(user.role) ? `<button class='assign-btn bg-blue-500 text-white px-2 py-1 rounded ml-2' data-user='${u.id}'>Assign Task</button>` : ''}`;
        list.appendChild(li);
      });

      dashboard.appendChild(section);
    }

    // Add collapsible toggle functionality
    document.querySelectorAll('.role-toggle').forEach(btn => {
      btn.addEventListener('click', () => {
        btn.nextElementSibling.classList.toggle('hidden');
      });
    });

    // Time-off requests only for Head
    if (user.role === 'Head') {
      const pendingRequests = timeOff.filter(r => r.status === 'Pending');
      if (pendingRequests.length) {
        const timeOffSection = document.createElement('div');
        timeOffSection.classList.add('mb-6');
        timeOffSection.innerHTML = `<h2 class='text-xl font-semibold mb-2'>Pending Time Off Requests</h2>`;
        const rList = document.createElement('ul');

        pendingRequests.forEach(r => {
          const requestUser = users.find(u => u.id === r.user_id);
          const li = document.createElement('li');
          li.innerHTML = `${requestUser?.username || r.user_id} - ${r.start_date} to ${r.end_date} 
            <button class='approve-btn bg-green-500 text-white px-2 py-1 rounded ml-1' data-id='${r.id}'>Approve</button>
            <button class='deny-btn bg-red-500 text-white px-2 py-1 rounded ml-1' data-id='${r.id}'>Deny</button>`;
          rList.appendChild(li);
        });

        timeOffSection.appendChild(rList);
        dashboard.appendChild(timeOffSection);
      }
    }

  } else {
    // Regular user: show personal tasks & time off
    const myTasks = tasks.filter(t => t.assigned_to === user.id);
    const myTimeOff = timeOff.filter(r => r.user_id === user.id);

    const tasksSection = document.createElement('div');
    tasksSection.classList.add('mb-4');
    tasksSection.innerHTML = `<h2 class='text-xl font-semibold mb-2'>My Tasks</h2>`;
    const tList = document.createElement('ul');
    myTasks.forEach(t => {
      const li = document.createElement('li');
      li.textContent = `${t.title} - ${t.status}`;
      tList.appendChild(li);
    });
    tasksSection.appendChild(tList);

    const timeSection = document.createElement('div');
    timeSection.innerHTML = `<h2 class='text-xl font-semibold mb-2'>My Time Off Requests</h2>`;
    const rList = document.createElement('ul');
    myTimeOff.forEach(r => {
      const li = document.createElement('li');
      li.textContent = `${r.start_date} to ${r.end_date} - ${r.status}`;
      rList.appendChild(li);
    });
    timeSection.appendChild(rList);

    dashboard.appendChild(tasksSection);
    dashboard.appendChild(timeSection);
  }
}

// Event listeners
document.addEventListener('click', async (e) => {
  // Approve/Deny time off
  if (e.target.classList.contains('approve-btn') || e.target.classList.contains('deny-btn')) {
    const id = e.target.dataset.id;
    const newStatus = e.target.classList.contains('approve-btn') ? 'Approved' : 'Denied';
    await client.from('time_off_requests').update({ status: newStatus }).eq('id', id);
    loadDashboard();
  }

  // Assign task
  if (e.target.classList.contains('assign-btn')) {
    const userId = e.target.dataset.user;
    const taskTitle = prompt("Enter task title:");
    if (taskTitle) {
      await client.from('tasks').insert([{ title: taskTitle, assigned_to: userId, status: 'Pending' }]);
      loadDashboard();
    }
  }
});

// Create new user
document.getElementById('create-user-btn').addEventListener('click', async () => {
  const newUsername = document.getElementById('new-username').value.trim();
  const newRole = document.getElementById('new-role').value;
  const newPassword = generatePassword();

  const validRoles = ['Head', 'Junior', 'Senior', 'Lead', 'Artist', 'Animator', 'Musician', 'Writer', 'VA'];
  if (!newUsername) return showError("Username is required!");
  if (!validRoles.includes(newRole)) return showError("Invalid role selected!");

  try {
    const { error } = await client.from('user').insert([{ username: newUsername, password: newPassword, role: newRole }]);
    if (error) throw error;
    showSuccess(`User "${newUsername}" created! Password: ${newPassword}`);
    document.getElementById('new-username').value = "";
    loadDashboard();
  } catch (err) {
    showError("Error creating user: " + err.message);
  }
});

// Helpers
function showError(msg) {
  const errorEl = document.getElementById('create-error');
  const successEl = document.getElementById('create-success');
  errorEl.textContent = msg;
  errorEl.classList.remove('hidden');
  successEl.classList.add('hidden');
}
function showSuccess(msg) {
  const errorEl = document.getElementById('create-error');
  const successEl = document.getElementById('create-success');
  successEl.textContent = msg;
  successEl.classList.remove('hidden');
  errorEl.classList.add('hidden');
}

// Logout
document.getElementById('logout').addEventListener('click', () => {
  localStorage.removeItem('session');
  window.location.href = 'index.html';
});

loadDashboard();
