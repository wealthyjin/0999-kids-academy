// Vercel serverless function: POST /api/session
// OPENAI_API_KEY must exist only in Vercel Project -> Settings -> Environment Variables.
const ALLOWED_ORIGIN = process.env.APP_ORIGIN || "";

const INSTRUCTIONS = [
  "你是0.999儿童成长学院的温柔、耐心、活泼的中文语音老师。",
  "你的学生是5岁半儿童，中文识字量较少，英语只认识少量单词，注意力容易分散，抗挫能力较弱。",
  "使用适合学龄前儿童的简短、自然、温柔的中文口语。一次只问一个问题，等待孩子回答。",
  "不要把教学变成连续选择题。优先用故事、角色扮演、观察、猜想、生活实验和游戏引导。",
  "孩子答错时不批评、不羞辱、不比较；先肯定尝试，再给一个小提示。遇到挫败时降低难度。",
  "允许孩子随时打断你。听到孩子插话时停止当前讲述，先回应孩子真正说的内容。",
  "涉及水、电、磁铁、小零件、工具、户外活动时，提醒需要家长在场，不指导孩子独自操作。",
  "不询问孩子的全名、住址、学校、联系方式等个人信息。不要要求孩子上传照片或录音。",
  "如果孩子表达情绪或说到被欺负、被诬陷，先安抚并帮助区分事实、猜测和感受，鼓励找可信任的大人协助，不鼓励报复或秘密行动。",
  "你是教学陪伴者，不替代家长、教师或专业心理支持。"
].join("\n");

module.exports = async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Vary", "Origin");
  const origin = req.headers.origin || "";
  if (ALLOWED_ORIGIN && origin && origin !== ALLOWED_ORIGIN) {
    return res.status(403).json({ error: "Origin not allowed" });
  }
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }
  if (!process.env.OPENAI_API_KEY) {
    return res.status(503).json({
      error: "Server is not configured yet",
      detail: "请在Vercel服务端环境变量中设置OPENAI_API_KEY。不要把Key写入网页或GitHub。"
    });
  }
  try {
    const response = await fetch("https://api.openai.com/v1/realtime/client_secrets", {
      method: "POST",
      headers: {
        "Authorization": "Bearer " + process.env.OPENAI_API_KEY,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        expires_after: { anchor: "created_at", seconds: 600 },
        session: {
          type: "realtime",
          model: "gpt-realtime-2.1",
          instructions: INSTRUCTIONS,
          audio: {
            input: {
              turn_detection: {
                type: "semantic_vad",
                eagerness: "medium",
                create_response: true,
                interrupt_response: true
              }
            },
            output: {
              voice: "marin"
            }
          }
        }
      })
    });
    const data = await response.json();
    if (!response.ok) {
      console.error("Realtime client secret request failed:", response.status, data.error?.type || "unknown");
      return res.status(response.status).json({ error: "Unable to create voice session" });
    }
    return res.status(200).json({
      value: data.value,
      expires_at: data.expires_at,
      session: data.session ? { id: data.session.id, model: data.session.model } : undefined
    });
  } catch (error) {
    console.error("Realtime session error:", error.message);
    return res.status(500).json({ error: "Voice session initialization failed" });
  }
};
