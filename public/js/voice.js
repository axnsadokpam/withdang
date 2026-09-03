const ICE_CONFIG = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' }
  ]
};

class VoiceChatController {
  constructor(socket, callbacks = {}) {
    this.socket = socket;
    this.callbacks = callbacks;
    this.localStream = null;
    this.peers = {}; // peerId -> RTCPeerConnection
    this.audioElements = {}; // peerId -> HTMLAudioElement
    this.isJoined = false;
    this.isMuted = false;
    this.audioContext = null;
    this.analyser = null;
    this.micCheckInterval = null;
    this.isSpeaking = false;

    this.setupSignaling();
  }

  setupSignaling() {
    // A remote peer joined voice
    this.socket.on('voice-peer-joined', async ({ peerId, playerName }) => {
      if (!this.isJoined || !this.localStream) return;
      console.log('[Voice] Peer joined voice:', peerId, playerName);
      await this.initiateCall(peerId);
    });

    // Received WebRTC signal (offer, answer, or candidate)
    this.socket.on('voice-signal', async ({ from, data }) => {
      if (!this.isJoined || !this.localStream) return;

      try {
        if (data.type === 'offer') {
          await this.handleOffer(from, data.sdp);
        } else if (data.type === 'answer') {
          await this.handleAnswer(from, data.sdp);
        } else if (data.type === 'candidate' && data.candidate) {
          const pc = this.peers[from];
          if (pc) {
            await pc.addIceCandidate(new RTCIceCandidate(data.candidate));
          }
        }
      } catch (err) {
        console.error('[Voice] Signal handling error:', err);
      }
    });

    // Remote peer left voice
    this.socket.on('voice-peer-left', ({ peerId }) => {
      this.closePeer(peerId);
      if (this.callbacks.onSpeaking) {
        this.callbacks.onSpeaking(peerId, false);
      }
    });

    // Remote peer speaking status
    this.socket.on('voice-peer-speaking', ({ peerId, isSpeaking }) => {
      if (this.callbacks.onSpeaking) {
        this.callbacks.onSpeaking(peerId, isSpeaking);
      }
    });
  }

  async joinVoice() {
    if (this.isJoined) return true;

    try {
      this.localStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        },
        video: false
      });

      this.isJoined = true;
      this.isMuted = false;
      this.setupVoiceActivityDetection();

      // Announce join to signaling server
      this.socket.emit('voice-join');

      if (this.callbacks.onStatusChange) {
        this.callbacks.onStatusChange({ joined: true, muted: false });
      }
      return true;
    } catch (err) {
      console.warn('[Voice] Microphone access denied or unavailable:', err.message);
      if (this.callbacks.onError) {
        this.callbacks.onError('Microphone access denied. Check browser permissions.');
      }
      return false;
    }
  }

  leaveVoice() {
    if (!this.isJoined) return;

    if (this.micCheckInterval) {
      clearInterval(this.micCheckInterval);
      this.micCheckInterval = null;
    }

    if (this.localStream) {
      this.localStream.getTracks().forEach(t => t.stop());
      this.localStream = null;
    }

    if (this.audioContext && this.audioContext.state !== 'closed') {
      this.audioContext.close().catch(() => {});
      this.audioContext = null;
    }

    Object.keys(this.peers).forEach(peerId => this.closePeer(peerId));

    this.isJoined = false;
    this.isMuted = false;
    this.socket.emit('voice-leave');

    if (this.callbacks.onStatusChange) {
      this.callbacks.onStatusChange({ joined: false, muted: false });
    }
    if (this.callbacks.onSpeaking) {
      this.callbacks.onSpeaking(this.socket.id, false);
    }
  }

  toggleMute() {
    if (!this.isJoined || !this.localStream) return false;

    this.isMuted = !this.isMuted;
    this.localStream.getAudioTracks().forEach(t => {
      t.enabled = !this.isMuted;
    });

    if (this.isMuted) {
      this.isSpeaking = false;
      this.socket.emit('voice-speaking', { isSpeaking: false });
      if (this.callbacks.onSpeaking) {
        this.callbacks.onSpeaking(this.socket.id, false);
      }
    }

    if (this.callbacks.onStatusChange) {
      this.callbacks.onStatusChange({ joined: true, muted: this.isMuted });
    }
    return this.isMuted;
  }

  createPeerConnection(peerId) {
    const pc = new RTCPeerConnection(ICE_CONFIG);
    this.peers[peerId] = pc;

    if (this.localStream) {
      this.localStream.getTracks().forEach(track => {
        pc.addTrack(track, this.localStream);
      });
    }

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        this.socket.emit('voice-signal', {
          to: peerId,
          data: { type: 'candidate', candidate: event.candidate }
        });
      }
    };

    pc.ontrack = (event) => {
      let audio = this.audioElements[peerId];
      if (!audio) {
        audio = document.createElement('audio');
        audio.autoplay = true;
        audio.style.display = 'none';
        document.body.appendChild(audio);
        this.audioElements[peerId] = audio;
      }
      audio.srcObject = event.streams[0];
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed' || pc.connectionState === 'closed') {
        this.closePeer(peerId);
      }
    };

    return pc;
  }

  async initiateCall(peerId) {
    this.closePeer(peerId);
    const pc = this.createPeerConnection(peerId);

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);

    this.socket.emit('voice-signal', {
      to: peerId,
      data: { type: 'offer', sdp: offer }
    });
  }

  async handleOffer(fromPeerId, offerSdp) {
    this.closePeer(fromPeerId);
    const pc = this.createPeerConnection(fromPeerId);

    await pc.setRemoteDescription(new RTCSessionDescription(offerSdp));
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);

    this.socket.emit('voice-signal', {
      to: fromPeerId,
      data: { type: 'answer', sdp: answer }
    });
  }

  async handleAnswer(fromPeerId, answerSdp) {
    const pc = this.peers[fromPeerId];
    if (pc) {
      await pc.setRemoteDescription(new RTCSessionDescription(answerSdp));
    }
  }

  closePeer(peerId) {
    if (this.peers[peerId]) {
      this.peers[peerId].close();
      delete this.peers[peerId];
    }
    if (this.audioElements[peerId]) {
      this.audioElements[peerId].srcObject = null;
      this.audioElements[peerId].remove();
      delete this.audioElements[peerId];
    }
  }

  setupVoiceActivityDetection() {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx || !this.localStream) return;

      this.audioContext = new AudioCtx();
      const source = this.audioContext.createMediaStreamSource(this.localStream);
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 256;
      source.connect(this.analyser);

      const buffer = new Uint8Array(this.analyser.frequencyBinCount);

      this.micCheckInterval = setInterval(() => {
        if (!this.isJoined || this.isMuted) return;

        this.analyser.getByteFrequencyData(buffer);
        let sum = 0;
        for (let i = 0; i < buffer.length; i++) {
          sum += buffer[i];
        }
        const average = sum / buffer.length;
        const currentlySpeaking = average > 14; // volume threshold

        if (currentlySpeaking !== this.isSpeaking) {
          this.isSpeaking = currentlySpeaking;
          this.socket.emit('voice-speaking', { isSpeaking: this.isSpeaking });
          if (this.callbacks.onSpeaking) {
            this.callbacks.onSpeaking(this.socket.id, this.isSpeaking);
          }
        }
      }, 70);
    } catch (e) {
      console.warn('[Voice] Audio analyzer unavailable:', e);
    }
  }
}

window.VoiceChatController = VoiceChatController;
