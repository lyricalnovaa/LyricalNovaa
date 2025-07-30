let pollData = [];
let userVoted = false;

const audioUpload = document.getElementById('audioUpload');
const songInputs = document.getElementById('songInputs');
const pollForm = document.getElementById('pollForm');
const voteForm = document.getElementById('voteForm');
const pollSection = document.getElementById('pollSection');
const pollResults = document.getElementById('pollResults');

// Add new files to pollData and render inputs
audioUpload.addEventListener('change', (event) => {
  const newFiles = Array.from(event.target.files);

  newFiles.forEach((file) => {
    pollData.push({
      id: `song-${pollData.length}`,
      file: file,
      nameInput: null,
      votes: 0
    });
  });

  renderSongInputs();
  event.target.value = ''; // reset input so same files can be re-uploaded
});

function renderSongInputs() {
  songInputs.innerHTML = '';

  pollData.forEach((data, index) => {
    const container = document.createElement('div');
    container.className = 'song-entry';

    const label = document.createElement('label');
    label.textContent = 'Name this song:';

    let nameInput = data.nameInput;
    if (!nameInput) {
      nameInput = document.createElement('input');
      nameInput.type = 'text';
      nameInput.placeholder = 'Song name';
      nameInput.required = true;
      nameInput.value = data.name || '';
      data.nameInput = nameInput;
    }

    // Update stored name on input change
    nameInput.oninput = () => {
      data.name = nameInput.value;
    };

    const audio = document.createElement('audio');
    audio.controls = true;
    audio.src = URL.createObjectURL(data.file);

    const removeBtn = document.createElement('button');
    removeBtn.type = 'button';
    removeBtn.textContent = 'Remove';
    removeBtn.style.marginLeft = '10px';
    removeBtn.onclick = () => {
      pollData.splice(index, 1);
      renderSongInputs();
    };

    container.appendChild(label);
    container.appendChild(nameInput);
    container.appendChild(audio);
    container.appendChild(removeBtn);

    songInputs.appendChild(container);
  });
}

pollForm.addEventListener('submit', (e) => {
  e.preventDefault();

  if (pollData.length === 0) {
    alert('Upload at least one song!');
    return;
  }

  // Validate all names filled
  for (const data of pollData) {
    if (!data.nameInput.value.trim()) {
      alert('All songs must have a name!');
      return;
    }
  }

  voteForm.innerHTML = '';

  pollData.forEach((data, index) => {
    const radio = document.createElement('input');
    radio.type = 'radio';
    radio.name = 'vote';
    radio.value = index;
    radio.id = `vote-${index}`;

    const label = document.createElement('label');
    label.setAttribute('for', `vote-${index}`);
    label.innerText = data.nameInput.value;

    voteForm.appendChild(radio);
    voteForm.appendChild(label);
    voteForm.appendChild(document.createElement('br'));
  });

  pollForm.style.display = 'none';
  pollSection.style.display = 'block';
});

function submitVote() {
  const selected = document.querySelector('input[name="vote"]:checked');
  if (!selected) return alert('Pick a song to vote on!');
  if (userVoted) return alert('You already voted!');

  const index = parseInt(selected.value);
  pollData[index].votes = (pollData[index].votes || 0) + 1;
  userVoted = true;

  renderPollResults();
}

function renderPollResults() {
  pollResults.innerHTML = '<h3>Live Poll Results</h3>';
  pollData.forEach((data) => {
    const result = document.createElement('div');
    result.innerText = `${data.nameInput.value}: ${data.votes || 0} votes`;
    pollResults.appendChild(result);
  });
  pollResults.style.display = 'block';
}

// Reset poll & vote
function resetPoll() {
  if (!confirm('Are you sure you want to reset the poll? All data will be lost.')) return;
  pollData = [];
  userVoted = false;
  songInputs.innerHTML = '';
  voteForm.innerHTML = '';
  pollResults.innerHTML = '';
  pollForm.style.display = 'block';
  pollSection.style.display = 'none';
}
