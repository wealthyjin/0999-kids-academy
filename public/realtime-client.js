/* 0.999 OpenAI Realtime WebRTC client.
   The browser receives only a short-lived client secret, never OPENAI_API_KEY. */
(() => {
  const $ = (id) => document.getElementById(id);
  let pc = null, dc = null, localStream = null, remoteAudio = null, connected = false;
  const setStatus = (s) => { const el = $("realtimeStatus"); if (el) el.textContent = s; };
  const setButtons = (on) => {
    const start = $("realtimeStart"), stop = $("realtimeStop");
    if (start) start.disabled = on;
    if (stop) stop.disabled = !on;
  };
  function cleanup() {
    connected = false;
    try { if (dc && dc.readyState === "open") dc.send(JSON.stringify({ type: "session.close" })); } catch (_) {}
    try { dc && dc.close(); } catch (_) {}
    try { pc && pc.close(); } catch (_) {}
    if (localStream) localStream.getTracks().forEach(t => t.stop());
    if (remoteAudio) { remoteAudio.pause(); remoteAudio.srcObject = null; }
    pc = null; dc = null; localStream = null; remoteAudio = null;
    setButtons(false);
  }
  async function start() {
    if (connected) return;
    if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia || !window.RTCPeerConnection) {
      setStatus("当前页面或浏览器不支持安全实时音频，请使用最新版Chrome并通过HTTPS打开。"); return;
    }
    try {
      setStatus("正在申请麦克风权限…");
      localStream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
      setStatus("正在安全建立AI语音连接…");
      const tokenRes = await fetch("/api/session", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}", cache: "no-store" });
      const tokenData = await tokenRes.json();
      if (!tokenRes.ok || !tokenData.value) throw new Error(tokenData.detail || tokenData.error || "无法取得临时语音凭证");
      pc = new RTCPeerConnection();
      remoteAudio = document.createElement("audio");
      remoteAudio.autoplay = true;
      remoteAudio.playsInline = true;
      remoteAudio.style.display = "none";
      document.body.appendChild(remoteAudio);
      pc.ontrack = (event) => {
        remoteAudio.srcObject = event.streams[0];
        remoteAudio.play().catch(() => setStatus("请点击页面一次以允许播放老师声音。"));
      };
      localStream.getTracks().forEach(track => pc.addTrack(track, localStream));
      dc = pc.createDataChannel("oai-events");
      dc.onopen = () => { connected = true; setButtons(true); setStatus("老师上线啦！可以直接说话，也可以随时打断老师。"); };
      dc.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === "input_audio_buffer.speech_started") setStatus("老师听到你开始说话了…");
          if (data.type === "input_audio_buffer.speech_stopped") setStatus("老师正在理解你的话…");
          if (data.type === "response.output_audio_transcript.done" && data.transcript) setStatus("老师：" + data.transcript);
          if (data.type === "conversation.item.input_audio_transcription.completed" && data.transcript) {
            const heard = $("realtimeHeard"); if (heard) heard.textContent = "你说：" + data.transcript;
          }
          if (data.type === "error") setStatus("语音服务提示：" + (data.error?.message || "请重试"));
        } catch (_) {}
      };
      dc.onerror = () => setStatus("语音事件通道出现问题，请重新连接。");
      pc.onconnectionstatechange = () => {
        if (pc && ["failed", "disconnected"].includes(pc.connectionState)) {
          setStatus("连接中断。请点击重新连接。"); cleanup();
        }
      };
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      const sdpRes = await fetch("https://api.openai.com/v1/realtime/calls", {
        method: "POST",
        body: offer.sdp,
        headers: { "Authorization": "Bearer " + tokenData.value, "Content-Type": "application/sdp" }
      });
      if (!sdpRes.ok) throw new Error("OpenAI实时语音连接失败（HTTP " + sdpRes.status + "）");
      await pc.setRemoteDescription({ type: "answer", sdp: await sdpRes.text() });
      setStatus("连接已建立，正在等待老师上线…");
    } catch (error) {
      cleanup();
      setStatus("连接失败：" + error.message + "。请检查Vercel环境变量和麦克风权限。");
    }
  }
  function stop() { cleanup(); setStatus("本次语音课程已结束。"); }
  window.addEventListener("DOMContentLoaded", () => {
    $("realtimeStart")?.addEventListener("click", start);
    $("realtimeStop")?.addEventListener("click", stop);
    setButtons(false);
  });
  window.addEventListener("beforeunload", cleanup);
})();
