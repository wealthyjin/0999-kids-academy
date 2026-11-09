// Vercel serverless function: POST /api/chat
// DeepSeek is the dialogue/reasoning model. Keep DEEPSEEK_API_KEY in Vercel env vars only.
const SYSTEM_PROMPT = [
  "你是0.999儿童成长学院的温柔、耐心、活泼的中文语音老师。",
  "学生5岁半，识字量较少，英语只认识少量单词，注意力容易分散，抗挫能力较弱。",
  "每次只说一到三句短句，一次只问一个问题。使用自然、温柔、适合学龄前儿童的语言。",
  "不要把教学变成连续选择题。优先使用故事、角色扮演、观察、猜想、生活实验和游戏。",
  "孩子答错时不批评、不羞辱、不比较；先肯定尝试，再给一个小提示。连续受挫就降低难度。",
  "理解孩子的完整意思，不要机械重复孩子的话。必要时先简短复述理解，再提出一个有启发性的问题。",
  "遇到冲突、被误解或被诬陷，帮助孩子区分事实、猜测和感受，鼓励找可信任的大人，不鼓励报复或秘密行动。",
  "涉及水、电、磁铁、小零件、工具、户外活动时，提醒需要家长在场。",
  "不询问孩子全名、住址、学校、联系方式；不要要求上传照片或录音。",
  "你是教学陪伴者，不替代家长、教师或专业心理支持。"
].join("\n");

module.exports = async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }
  if (!process.env.DEEPSEEK_API_KEY) {
    return res.status(503).json({ error: "DeepSeek not configured", detail: "请在Vercel服务端环境变量中设置DEEPSEEK_API_KEY，不要放进网页或GitHub。" });
  }
  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});
    const incoming = Array.isArray(body.messages) ? body.messages.slice(-12) : [];
    const safe = incoming
      .filter(m => m && ["user", "assistant"].includes(m.role) && typeof m.content === "string")
      .map(m => ({ role: m.role, content: m.content.slice(0, 3000) }));
    if (!safe.length || safe[safe.length - 1].role !== "user") {
      return res.status(400).json({ error: "A user message is required" });
    }
    const upstream = await fetch("https://api.deepseek.com/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": "Bearer " + process.env.DEEPSEEK_API_KEY,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "deepseek-flash",
        messages: [{ role: "system", content: SYSTEM_PROMPT }, ...safe],
        stream: false,
        thinking: { type: "disabled" },
        temperature: 0.7,
        max_tokens: 300
      })
    });
    const data = await upstream.json();
    if (!upstream.ok) {
      console.error("DeepSeek chat failed:", upstream.status, data.error?.message || "unknown");
      return res.status(502).json({ error: "DeepSeek request failed", upstream_status: upstream.status });
    }
    const reply = data.choices?.[0]?.message?.content;
    if (typeof reply !== "string" || !reply.trim()) {
      return res.status(502).json({ error: "Empty response from DeepSeek" });
    }
    return res.status(200).json({ reply: reply.trim(), model: data.model || "deepseek-flash" });
  } catch (error) {
    console.error("Chat endpoint error:", error.message);
    return res.status(500).json({ error: "Chat service failed" });
  }
};
