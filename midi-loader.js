import { Midi } from 'tone';

export class MidiLoader {
    constructor() {
        this.midiData = null;
        this.rawMidiBuffer = null;
        this.history = [];
    }

    saveState() {
        if (this.midiData) {
            this.history.push(this.midiData.toArray());
            // Limit history size to prevent memory issues
            if (this.history.length > 20) {
                this.history.shift();
            }
        }
    }

    undo() {
        if (this.history.length === 0) return false;
        const prevState = this.history.pop();
        this.midiData = new Midi(prevState);
        this.rawMidiBuffer = prevState;
        return true;
    }
    
    async loadMidi(file, timeOffset = 5) {
        try {
            this.rawMidiBuffer = await file.arrayBuffer();
            this.applyTimeOffset(timeOffset);
            console.log(`MIDI loaded and shifted by ${timeOffset}s:`, this.midiData);
            return true;
        } catch (error) {
            console.error('Error loading MIDI:', error);
            this.rawMidiBuffer = null; // Clear on error
            return false;
        }
    }

    createEmptyMidi() {
        this.midiData = new Midi();
        // Add one initial empty track
        this.midiData.addTrack();
        this.rawMidiBuffer = null; // No raw buffer for a new file yet
        return this.getTrackInfo();
    }

    addNewTrack() {
        if (!this.midiData) return null;
        this.saveState();
        const track = this.midiData.addTrack();
        track.name = `Layer ${this.midiData.tracks.length}`;
        this.updateBuffer();
        return this.midiData.tracks.length - 1; // Return index
    }

    addNoteToTrack(trackIndex, noteData) {
        if (!this.midiData || !this.midiData.tracks[trackIndex]) return;
        
        const track = this.midiData.tracks[trackIndex];
        track.addNote({
            name: noteData.name,
            time: noteData.time,
            duration: noteData.duration,
            velocity: noteData.velocity || 0.8
        });
    }

    updateBuffer() {
        if (this.midiData) {
            this.rawMidiBuffer = this.midiData.toArray();
        }
    }

    clearTrack(index) {
        if (!this.midiData || !this.midiData.tracks[index]) return false;
        this.saveState();
        this.midiData.tracks[index].notes = [];
        this.updateBuffer();
        return true;
    }

    deleteTrack(index) {
        if (!this.midiData || !this.midiData.tracks[index]) return false;
        this.saveState();
        this.midiData.tracks.splice(index, 1);
        this.updateBuffer();
        return true;
    }

    renameTrack(index, name) {
        if (!this.midiData || !this.midiData.tracks[index]) return false;
        this.saveState();
        this.midiData.tracks[index].name = name;
        this.updateBuffer();
        return true;
    }

    applyTimeOffset(timeOffset) {
        if (!this.rawMidiBuffer) return false;

        // Re-create from the raw buffer to get clean, unmodified note times
        // NOTE: If we recently recorded, rawMidiBuffer should have been updated.
        this.midiData = new Midi(this.rawMidiBuffer);

        // Shift all notes if a positive offset is provided
        if (timeOffset > 0) {
            this.midiData.tracks.forEach(track => {
                track.notes.forEach(note => {
                    note.time += timeOffset;
                });
            });
        }
        return true;
    }
    
    getAllNotes(activeTrackIndices) {
        if (!this.midiData) return [];
        
        const allNotes = [];
        this.midiData.tracks.forEach((track, index) => {
             if (activeTrackIndices === undefined || activeTrackIndices.has(index)) {
                track.notes.forEach(note => {
                    allNotes.push({
                        name: note.name,
                        time: note.time,
                        duration: note.duration,
                        velocity: note.velocity,
                        track: index
                    });
                });
            }
        });
        
        return allNotes.sort((a, b) => a.time - b.time);
    }
    
    getDuration() {
        return this.midiData ? this.midiData.duration : 0;
    }

    getTrackInfo() {
        if (!this.midiData) return [];
        return this.midiData.tracks.map((track, index) => ({
            index: index,
            name: track.name.trim() || `Track ${index + 1}`,
            instrument: track.instrument.name
        }));
    }
}