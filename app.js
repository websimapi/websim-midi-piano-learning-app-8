import { Piano } from './piano.js';
import { MidiPlayer } from './midi-player.js';

class App {
    constructor() {
        this.piano = new Piano();
        // The piano needs to be rendered before other components that depend on its layout
        this.piano.onPianoRendered = () => {
            this.midiPlayer = new MidiPlayer(this.piano);
        };
        
        this.setupEventListeners();
        this.piano.initializePiano(); // This will trigger the rendering and midiPlayer initialization
    }
    
    setupEventListeners() {
        const midiFileInput = document.getElementById('midi-file');
        const playBtn = document.getElementById('play-btn');
        const stopBtn = document.getElementById('stop-btn');
        const recordBtn = document.getElementById('record-btn');
        const delaySlider = document.getElementById('midi-delay');
        const delayValueSpan = document.getElementById('delay-value');
        const recordControls = document.getElementById('recording-controls');
        const addTrackBtn = document.getElementById('add-track-btn');
        const trackSelect = document.getElementById('record-track-select');
        const undoBtn = document.getElementById('undo-btn');
        const clearTrackBtn = document.getElementById('clear-track-btn');
        const deleteTrackBtn = document.getElementById('delete-track-btn');
        const renameTrackBtn = document.getElementById('rename-track-btn');
        
        delaySlider.addEventListener('input', () => {
            const newDelay = parseFloat(delaySlider.value);
            delayValueSpan.textContent = newDelay;
            // Update the midi player with the new delay if a file is loaded
            if (this.midiPlayer && this.midiPlayer.midiLoader.midiData) {
                const trackInfo = this.midiPlayer.updateMidiDelay(newDelay);
                this.updateTrackControls(trackInfo);
            }
        });

        midiFileInput.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (file) {
                const timeOffset = parseFloat(delaySlider.value);
                const trackInfo = await this.midiPlayer.loadMidi(file, timeOffset);
                if (trackInfo) {
                    playBtn.disabled = false;
                    playBtn.textContent = 'Play';
                    this.updateTrackControls(trackInfo);
                    this.updateRecordingUI(true);
                    console.log('MIDI file loaded successfully');
                } else {
                    alert('Error loading MIDI file');
                    this.updateTrackControls([]); // Clear controls on error
                }
            }
        });
        
        playBtn.addEventListener('click', () => {
            if (this.midiPlayer.isPlaying) {
                this.midiPlayer.pause();
                playBtn.textContent = 'Play';
                stopBtn.disabled = false;
            } else {
                this.midiPlayer.play();
                playBtn.textContent = 'Pause';
                playBtn.disabled = false;
                stopBtn.disabled = false;
            }
        });
        
        stopBtn.addEventListener('click', () => {
            if (this.midiPlayer.isRecording) {
                this.midiPlayer.stopRecording();
                recordBtn.classList.remove('recording');
                recordBtn.textContent = 'Record';
                
                // Refresh tracks as we might have added data
                const trackInfo = this.midiPlayer.midiLoader.getTrackInfo();
                this.updateTrackControls(trackInfo);
            } else {
                this.midiPlayer.stop();
            }
            playBtn.disabled = false;
            stopBtn.disabled = true;
            playBtn.textContent = 'Play';
        });

        recordBtn.addEventListener('click', () => {
            if (this.midiPlayer.isRecording) {
                // Stop recording
                this.midiPlayer.stopRecording();
                recordBtn.classList.remove('recording');
                recordBtn.textContent = 'Record';
                playBtn.textContent = 'Play';
                playBtn.disabled = false;
                stopBtn.disabled = true;
                
                const trackInfo = this.midiPlayer.midiLoader.getTrackInfo();
                this.updateTrackControls(trackInfo);
            } else {
                // Start recording
                
                // If no file loaded, create empty
                if (!this.midiPlayer.midiLoader.midiData) {
                    this.midiPlayer.midiLoader.createEmptyMidi();
                    const trackInfo = this.midiPlayer.midiLoader.getTrackInfo();
                    this.updateTrackControls(trackInfo);
                    this.updateRecordingUI(true);
                    
                    // Force buttons active since we effectively loaded a file
                    playBtn.disabled = false;
                    stopBtn.disabled = false;
                }

                this.midiPlayer.recordingTrackIndex = parseInt(trackSelect.value) || 0;
                this.midiPlayer.startRecording();
                recordBtn.classList.add('recording');
                recordBtn.textContent = 'Stop Rec';
                playBtn.textContent = 'Pause'; // Recording implies playing
                playBtn.disabled = false;
                stopBtn.disabled = false;
            }
        });

        addTrackBtn.addEventListener('click', () => {
            // If no MIDI, create empty first
            if (!this.midiPlayer.midiLoader.midiData) {
                 this.midiPlayer.midiLoader.createEmptyMidi();
                 playBtn.disabled = false;
                 this.updateRecordingUI(true);
            }
            
            const newIndex = this.midiPlayer.midiLoader.addNewTrack();
            if (newIndex !== null) {
                const trackInfo = this.midiPlayer.midiLoader.getTrackInfo();
                this.updateTrackControls(trackInfo);
                this.populateTrackSelect(trackInfo);
                trackSelect.value = newIndex; // Auto-select new track
                this.midiPlayer.recordingTrackIndex = newIndex;
            }
        });

        trackSelect.addEventListener('change', (e) => {
            this.midiPlayer.recordingTrackIndex = parseInt(e.target.value);
        });

        undoBtn.addEventListener('click', () => {
            const trackInfo = this.midiPlayer.undo();
            if (trackInfo) {
                this.updateTrackControls(trackInfo);
                this.populateTrackSelect(trackInfo);
                trackSelect.value = this.midiPlayer.recordingTrackIndex;
            }
        });

        clearTrackBtn.addEventListener('click', () => {
            if (confirm('Clear all notes in the selected track?')) {
                const trackInfo = this.midiPlayer.clearTrack();
                if (trackInfo) {
                    this.updateTrackControls(trackInfo);
                }
            }
        });

        deleteTrackBtn.addEventListener('click', () => {
            if (confirm('Delete the selected track? This cannot be undone by this button (use Undo).')) {
                const trackInfo = this.midiPlayer.deleteTrack();
                if (trackInfo) {
                    this.updateTrackControls(trackInfo);
                    this.populateTrackSelect(trackInfo);
                    trackSelect.value = this.midiPlayer.recordingTrackIndex;
                }
            }
        });

        renameTrackBtn.addEventListener('click', () => {
            const currentName = trackSelect.options[trackSelect.selectedIndex]?.text || '';
            const newName = prompt('Enter new name for track:', currentName);
            if (newName && newName.trim() !== '') {
                const trackInfo = this.midiPlayer.renameTrack(newName.trim());
                if (trackInfo) {
                    this.updateTrackControls(trackInfo);
                    this.populateTrackSelect(trackInfo);
                    trackSelect.value = this.midiPlayer.recordingTrackIndex;
                }
            }
        });

        this.setupTimelineListeners();
    }

    updateRecordingUI(hasMidi) {
        const recordControls = document.getElementById('recording-controls');
        if (hasMidi || true) { // Always show, or logic depending on needs. Prompt implies we can record over empty.
            recordControls.style.display = 'flex';
            const trackInfo = this.midiPlayer.midiLoader.getTrackInfo();
            this.populateTrackSelect(trackInfo);
        }
    }

    populateTrackSelect(trackInfo) {
        const select = document.getElementById('record-track-select');
        const currentVal = select.value;
        select.innerHTML = '';
        
        trackInfo.forEach(track => {
            const option = document.createElement('option');
            option.value = track.index;
            option.textContent = track.name || `Track ${track.index + 1}`;
            select.appendChild(option);
        });

        if (currentVal && trackInfo.find(t => t.index == currentVal)) {
            select.value = currentVal;
        }
    }

    setupTimelineListeners() {
        const timelineContainer = document.getElementById('timeline-container');
        let isDragging = false;

        const handleSeek = (e) => {
            if (!this.midiPlayer.midiLoader.midiData) return;
            
            const rect = timelineContainer.getBoundingClientRect();
            const x = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
            const percentage = x / rect.width;
            
            const duration = this.midiPlayer.midiLoader.getDuration();
            const seekTime = duration * percentage;
            
            this.midiPlayer.seek(seekTime);
        };

        timelineContainer.addEventListener('mousedown', (e) => {
            isDragging = true;
            handleSeek(e);
        });

        window.addEventListener('mousemove', (e) => {
            if (isDragging) {
                e.preventDefault();
                handleSeek(e);
            }
        });

        window.addEventListener('mouseup', () => {
            isDragging = false;
        });
    }

    updateTrackControls(tracks) {
        const trackControlsContainer = document.getElementById('track-controls');
        trackControlsContainer.innerHTML = ''; // Clear existing controls

        // Also update the select dropdown whenever tracks change
        this.populateTrackSelect(tracks);

        if (!tracks || tracks.length === 0) {
            return;
        }
        
        const colors = ['#ff6b6b', '#4ecdc4', '#ffc837', '#7b2cbf', '#f77f00', '#00f5d4'];

        tracks.forEach((track, index) => {
            const btn = document.createElement('button');
            const isActive = this.midiPlayer.activeTrackIndices.has(track.index);
            btn.className = isActive ? 'track-toggle-btn active' : 'track-toggle-btn';
            btn.dataset.trackIndex = track.index;

            const icon = document.createElement('div');
            icon.className = 'track-icon';
            icon.style.backgroundColor = colors[index % colors.length];

            const label = document.createElement('span');
            label.textContent = track.name;
            
            btn.appendChild(icon);
            btn.appendChild(label);

            btn.addEventListener('click', () => {
                const wasActive = btn.classList.toggle('active');
                this.midiPlayer.setTrackEnabled(track.index, wasActive);
            });

            trackControlsContainer.appendChild(btn);
        });
    }
}

// Initialize app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new App();
});