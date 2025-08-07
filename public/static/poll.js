let currentUserRole = null; // fetched from server
let hasVotedPolls = new Set(); // local client cache

async function fetchUserProfile() {
  const res = await fetch('/api/profile');
  if (!res.ok) return alert('Failed to fetch user profile');
  const data = await res.json();
  currentUserRole = data.role;
  document.getElementById('userRoleDisplay')?.textContent = `Role: ${currentUserRole}`;
  setupUIByRole();
  loadEvents();
}

function setupUIByRole() {
  const createEventBtn = document.getElementById('create-event-btn');
  const eventSection = document.getElementById('eventCreationSection');
  if (currentUserRole === 'admin') {
    createEventBtn.style.display = 'inline-block';
    eventSection.style.display = 'none';
    createEventBtn.onclick = () => {
      eventSection.style.display = eventSection.style.display === 'block' ? 'none' : 'block';
    };
  } else {
    createEventBtn.style.display = 'none';
    eventSection.style.display = 'none';
  }
}

const songFiles = [];
const songNamesInputs = [];

document.getElementById('audioUpload').addEventListener('change', (e) => {
  const files = e.target.files;
  const container = document.getElementById('songInputs');
  container.innerHTML = '';
  songFiles.length = 0;
  songNamesInputs.length = 0;

  Array.from(files).forEach((file, i) => {
    songFiles.push(file);
    const div = document.createElement('div');
    div.classList.add('poll-song');

    const label = document.createElement('label');
    label.textContent = `Song name: `;

    const input = document.createElement('input');
    input.type = 'text';
    input.required = true;
    input.placeholder = 'Custom song name';
    songNamesInputs.push(input);

    const audio = document.createElement('audio');
    audio.controls = true;
    audio.src = URL.createObjectURL(file);

    div.appendChild(label);
    div.appendChild(input);
    div.appendChild(audio);
    container.appendChild(div);
  });
});

document.getElementById('createEventForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  for (const input of songNamesInputs) {
    if (!input.value.trim()) return alert('All songs must have names!');
  }

  const formData = new FormData();
  formData.append('eventName', document.getElementById('eventName').value);
  const songNames = songNamesInputs.map(input => input.value.trim());
  formData.append('songNames', JSON.stringify(songNames));
  songFiles.forEach(file => formData.append('songs', file));

  try {
    const res = await fetch('/api/create-event', {
      method: 'POST',
      body: formData,
    });
    if (!res.ok) {
      const error = await res.json();
      alert('Error: ' + error.error);
      return;
    }
    alert('Event created successfully!');
    e.target.reset();
    document.getElementById('songInputs').innerHTML = '';
    songFiles.length = 0;
    songNamesInputs.length = 0;
    document.getElementById('eventCreationSection').style.display = 'none';
    loadEvents();
  } catch {
    alert('Failed to create event');
  }
});

async function loadEvents() {
  const container = document.getElementById('eventsContainer');
  container.innerHTML = '<p>Loading events...</p>';

  const res = await fetch('/api/events');
  if (!res.ok) {
    container.innerHTML = '<p>Failed to load events</p>';
    return;
  }

  const events = await res.json();
  container.innerHTML = '';

  if (events.length === 0) {
    container.innerHTML = '<p>No events found.</p>';
    return;
  }

  events.forEach(event => {
    const eventDiv = document.createElement('div');
    eventDiv.classList.add('event');

    const title = document.createElement('h3');
    title.textContent = event.name;
    eventDiv.appendChild(title);

    if (currentUserRole === 'admin') {
      const delBtn = document.createElement('button');
      delBtn.textContent = 'Delete Event';
      delBtn.onclick = () => deleteEvent(event.id);
      eventDiv.appendChild(delBtn);
    }

    const pollContainer = document.createElement('div');
    pollContainer.classList.add('poll-group');
    const userVoted = event.polls.some(p => hasVotedPolls.has(p.id));

    event.polls.forEach(poll => {
      const pollDiv = document.createElement('div');
      pollDiv.classList.add('poll-song');

      const audio = document.createElement('audio');
      audio.controls = true;
      audio.src = poll.filePath;
      pollDiv.appendChild(audio);

      const label = document.createElement('label');
      label.textContent = poll.songName;
      pollDiv.appendChild(label);

      if (currentUserRole !== 'admin') {
        const voteBtn = document.createElement('button');
        voteBtn.textContent = hasVotedPolls.has(poll.id) ? 'Voted' : 'Vote';
        voteBtn.disabled = userVoted;
        voteBtn.onclick = () => votePoll(poll.id, event.id);
        pollDiv.appendChild(voteBtn);
      }

      const resultDiv = document.createElement('div');
      resultDiv.classList.add('poll-result');
      resultDiv.id = `result-${poll.id}`;
      pollDiv.appendChild(resultDiv);

      if (userVoted) {
        fetchPollResults(event.id);
      }

      pollContainer.appendChild(pollDiv);
    });

    eventDiv.appendChild(pollContainer);
    container.appendChild(eventDiv);
  });
}

async function votePoll(pollId, eventId) {
  if (currentUserRole === 'admin') return alert("Admins can't vote lol");

  try {
    const res = await fetch('/api/vote', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pollId }),
    });
    if (!res.ok) {
      const err = await res.json();
      alert('Error voting: ' + err.error);
      return;
    }

    hasVotedPolls.add(pollId);
    alert('Vote counted!');
    await fetchPollResults(eventId);
    loadEvents();
  } catch {
    alert('Failed to send vote');
  }
}

async function fetchPollResults(eventId) {
  try {
    const res = await fetch(`/api/poll-results/${eventId}`);
    if (!res.ok) return;

    const results = await res.json();
    results.forEach(p => {
      const resultBox = document.getElementById(`result-${p.id}`);
      if (resultBox) {
        resultBox.textContent = `${p.songName} — ${p.votes} votes (${p.percentage.toFixed(1)}%)`;
      }
    });
  } catch {
    console.error('Error fetching poll results');
  }
}

async function deleteEvent(eventId) {
  if (!confirm('Delete this event and all its polls?')) return;
  try {
    const res = await fetch(`/api/events/${eventId}`, { method: 'DELETE' });
    if (!res.ok) {
      const err = await res.json();
      alert('Failed to delete event: ' + err.error);
      return;
    }
    alert('Event deleted');
    loadEvents();
  } catch {
    alert('Error deleting event');
  }
}

fetchUserProfile();
