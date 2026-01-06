import { GoogleGenAI, Type } from "https://esm.sh/@google/genai@^1.11.0";

// --- STATE MANAGEMENT ---
let state = {
    cvData: null,
    cvImage: { file: null, preview: null },
    docxFile: { file: null, text: null },
    analysisResult: null,
    isLoading: false,
    error: null,
    activeTab: 'preview', // 'preview' or 'analysis'
    isDragging: false,
};

// --- DOM ELEMENTS ---
const DOMElements = {
    uploadView: document.getElementById('upload-view'),
    uploadContent: document.getElementById('upload-content'),
    uploadLoading: document.getElementById('upload-loading'),
    mainView: document.getElementById('main-view'),
    imageUploadContainer: document.getElementById('image-upload-container'),
    imagePreviewWrapper: document.getElementById('image-preview-wrapper'),
    imagePreview: document.getElementById('image-preview'),
    removeImageButton: document.getElementById('remove-image-button'),
    docxPreviewWrapper: document.getElementById('docx-preview-wrapper'),
    docxFilename: document.getElementById('docx-filename'),
    removeDocxButton: document.getElementById('remove-docx-button'),
    dropZone: document.getElementById('drop-zone'),
    fileInput: document.getElementById('file-input'),
    errorMessage: document.getElementById('error-message'),
    reanalyzeButton: document.getElementById('reanalyze-button'),
    reanalyzeButtonText: document.getElementById('reanalyze-button-text'),
    reanalyzeButtonLoading: document.getElementById('reanalyze-button-loading'),
    cvEditor: document.getElementById('cv-editor'),
    resultContainer: document.getElementById('result-container'),
    cvPreviewContainer: document.getElementById('cv-preview-container'),
    analysisResultContainer: document.getElementById('analysis-result-container'),
    previewTab: document.getElementById('preview-tab'),
    analysisTab: document.getElementById('analysis-tab'),
    downloadDocxButton: document.getElementById('download-docx-button'),
};

// --- GEMINI API SERVICE ---
function resolveAgentCVKey() {
    try {
        let key = '';
        if (typeof window !== 'undefined' && window.AppConfig) {
            key = window.AppConfig.APIs.gemini.getKey('agentCV') || '';
        }
        if ((!key || !key.trim()) && typeof window !== 'undefined' && window.APIKeyLibrary) {
            key = window.APIKeyLibrary.google.gemini.getActiveKey() || '';
        }
        return key;
    } catch (_) { return ''; }
}

function rotateAgentCVKey() {
    try {
        if (typeof window !== 'undefined' && window.APIKeyLibrary) {
            const next = window.APIKeyLibrary.google.gemini.nextKey();
            if (typeof window !== 'undefined' && window.AppConfig && next) {
                // cập nhật key hiện hành trong AppConfig để các lần dùng sau đồng bộ
                window.AppConfig.APIs.gemini.keys.agentCV = next;
            }
            return next;
        }
    } catch (_) { /* ignore */ }
    return '';
}
 
// NOTE: Embedded API key for quick local run (insecure for production).
const EMBEDDED_AGENTCV_KEY = 'AIzaSyCYB0Q-_9b0lune0CjEYSor124M4bcGVwY';

let ai;
let currentKey = EMBEDDED_AGENTCV_KEY || resolveAgentCVKey();
try {
    ai = new GoogleGenAI({ apiKey: currentKey });
} catch (e) {
    console.error("API Key initialization failed:", e);
    state.error = "Không thể khởi tạo Trợ lý AI. Vui lòng kiểm tra API Key hoặc kết nối mạng.";
}

const cvDataSchema = {
    type: Type.OBJECT,
    properties: {
        fullName: { type: Type.STRING, description: "Họ và tên đầy đủ của ứng viên." },
        email: { type: Type.STRING, description: "Địa chỉ email." },
        phone: { type: Type.STRING, description: "Số điện thoại." },
        linkedin: { type: Type.STRING, description: "URL đến trang LinkedIn, nếu có." },
        summary: { type: Type.STRING, description: "Phần tóm tắt bản thân hoặc mục tiêu nghề nghiệp." },
        experience: {
            type: Type.ARRAY,
            description: "Danh sách kinh nghiệm làm việc.",
            items: {
                type: Type.OBJECT,
                properties: {
                    company: { type: Type.STRING, description: "Tên công ty." },
                    title: { type: Type.STRING, description: "Chức danh." },
                    description: { type: Type.STRING, description: "Mô tả chi tiết công việc và thành tích." },
                },
                 required: ["company", "title", "description"]
            },
        },
        education: { type: Type.STRING, description: "Thông tin học vấn, bằng cấp." },
        skills: { type: Type.STRING, description: "Danh sách các kỹ năng, cách nhau bởi dấu phẩy." },
    },
    required: ["fullName", "summary", "experience", "education", "skills", "email", "phone", "linkedin"]
};

const analysisSchema = {
    type: Type.OBJECT,
    properties: {
        generalAnalysis: {
            type: Type.OBJECT,
            properties: {
                strengths: { type: Type.ARRAY, items: { type: Type.STRING } },
                weaknesses: { type: Type.ARRAY, items: { type: Type.STRING } },
            },
        },
        detailedCorrections: {
            type: Type.ARRAY,
            items: {
                type: Type.OBJECT,
                properties: {
                    original: { type: Type.STRING },
                    suggestion: { type: Type.STRING },
                },
            },
        },
        enhancementSuggestions: {
            type: Type.OBJECT,
            properties: {
                skills: { type: Type.ARRAY, items: { type: Type.STRING } },
                keywords: { type: Type.ARRAY, items: { type: Type.STRING } },
                projects: { type: Type.ARRAY, items: { type: Type.STRING } },
            },
        },
        rewrittenContent: {
            type: Type.OBJECT,
            properties: {
                summary: { type: Type.STRING },
                experience: { 
                    type: Type.ARRAY,
                    items: {
                      type: Type.OBJECT,
                      properties: {
                          original: { type: Type.STRING, description: "Mô tả kinh nghiệm gốc, giữ nguyên để đối chiếu." },
                          rewritten: { type: Type.STRING, description: "Mô tả kinh nghiệm đã được viết lại, tập trung vào thành tích." },
                      },
                      required: ["original", "rewritten"]
                    },
                },
            },
        },
    },
};

const fullAnalysisSchema = {
    type: Type.OBJECT,
    properties: {
        extractedCv: cvDataSchema,
        analysis: analysisSchema,
    },
    required: ["extractedCv", "analysis"]
};

async function analyzeCVImage(imageBase64, mimeType) {
    const model = 'gemini-2.5-flash';
    const systemInstruction = `Bạn là một chuyên gia tuyển dụng và trợ lý AI thông minh, nói tiếng Việt. Nhiệm vụ của bạn là:
1.  **Trích xuất thông tin** từ hình ảnh CV được cung cấp. Điền tất cả thông tin bạn tìm thấy vào đối tượng JSON 'extractedCv'. Nếu không tìm thấy thông tin cho một trường nào đó, hãy để nó là một chuỗi trống (ví dụ: "").
2.  **Phân tích CV** dựa trên thông tin vừa trích xuất. Cung cấp phân tích chi tiết, đề xuất cải thiện, và viết lại nội dung để làm cho CV chuyên nghiệp và hấp dẫn hơn. Điền kết quả phân tích vào đối tượng JSON 'analysis'.
3.  Khi viết lại kinh nghiệm, hãy sử dụng các động từ mạnh, định lượng hóa kết quả và nhấn mạnh thành tích thay vì chỉ mô tả công việc.
4.  Đối với các đề xuất cải thiện, hãy đưa ra những gợi ý chung có thể áp dụng cho nhiều ngành nghề.
5.  Luôn trả về một đối tượng JSON duy nhất, hợp lệ theo đúng schema đã định nghĩa.`;

    const prompt = `Vui lòng trích xuất và phân tích CV trong hình ảnh này. Hãy đưa ra những đánh giá và đề xuất cải thiện một cách tổng quát.`;

    const imagePart = { inlineData: { mimeType, data: imageBase64 } };
    const textPart = { text: prompt };

        // Preemptive rotate based on time/RPM if needed
        try {
            if (window.KeySwapManager && window.KeySwapManager.shouldRotateKey()) {
                const nextKey = rotateAgentCVKey();
                if (nextKey && nextKey !== currentKey) {
                    currentKey = nextKey;
                    ai = new GoogleGenAI({ apiKey: currentKey });
                    window.KeySwapManager.markSwitched();
                }
            }
        } catch(_) {}

        // Retry với luân phiên API key khi gặp lỗi quota/auth
        const maxAttempts = (typeof window !== 'undefined' && window.APIKeyLibrary && window.APIKeyLibrary.google?.gemini?.pool?.length)
            ? window.APIKeyLibrary.google.gemini.pool.length + 1
            : 2;
        let lastErr;
        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
            try {
                const response = await ai.models.generateContent({
                    model: model,
                    contents: { parts: [imagePart, textPart] },
                    config: {
                        systemInstruction: systemInstruction,
                        responseMimeType: "application/json",
                        responseSchema: fullAnalysisSchema,
                        temperature: 0.3,
                    },
                });
                if (window.KeySwapManager) window.KeySwapManager.recordRequest({ tokensEstimated: 0 });

                const jsonText = response.text.trim();
                const result = JSON.parse(jsonText);
                if (!result.extractedCv || !result.analysis) {
                    throw new Error("Phản hồi từ AI không có định dạng như mong đợi.");
                }
                return result;
            } catch (error) {
                lastErr = error;
                const msg = String(error?.message || '').toLowerCase();
                const status = error?.status || error?.response?.status || 0;
                const quotaLike = msg.includes('quota') || msg.includes('exceed') || status === 429;
                const authLike = msg.includes('api key') || msg.includes('unauthorized') || msg.includes('permission') || status === 401 || status === 403;

                if ((quotaLike || authLike) && attempt < maxAttempts) {
                    const nextKey = rotateAgentCVKey();
                    if (nextKey && nextKey !== currentKey) {
                        currentKey = nextKey;
                        ai = new GoogleGenAI({ apiKey: currentKey });
                        if (window.KeySwapManager) window.KeySwapManager.markSwitched();
                        continue; // thử lại với key kế tiếp
                    }
                }
                // Không còn key nào khác hoặc lỗi không thuộc quota/auth
                break;
            }
        }
        console.error("Lỗi khi gọi Gemini API:", lastErr);
        throw new Error("Không thể phân tích hình ảnh CV. Vui lòng thử lại hoặc kiểm tra cấu hình AI và hạn mức API.");
}

async function analyzeDocxText(docxText) {
    const model = 'gemini-2.5-flash';
    const systemInstruction = `Bạn là một chuyên gia tuyển dụng và trợ lý AI thông minh, nói tiếng Việt. Nhiệm vụ của bạn là:
1. **Trích xuất thông tin** từ nội dung văn bản CV được cung cấp. Điền tất cả thông tin bạn tìm thấy vào đối tượng JSON 'extractedCv'. Nếu không tìm thấy thông tin cho một trường nào đó, hãy để nó là một chuỗi trống.
2. **Phân tích CV** dựa trên thông tin vừa trích xuất. Cung cấp phân tích chi tiết, đề xuất cải thiện, và viết lại nội dung để làm cho CV chuyên nghiệp và hấp dẫn hơn. Điền kết quả phân tích vào đối tượng JSON 'analysis'.
3. Khi viết lại kinh nghiệm, hãy sử dụng các động từ mạnh, định lượng hóa kết quả và nhấn mạnh thành tích thay vì chỉ mô tả công việc.
4. Đối với các đề xuất cải thiện, hãy đưa ra những gợi ý chung có thể áp dụng cho nhiều ngành nghề.
5. Luôn trả về một đối tượng JSON duy nhất, hợp lệ theo đúng schema đã định nghĩa.`;

    const prompt = `Vui lòng trích xuất và phân tích CV từ nội dung văn bản sau.`;
    const textPart = { text: `${prompt}\n\n${docxText}` };

    try {
        if (window.KeySwapManager && window.KeySwapManager.shouldRotateKey()) {
            const nextKey = rotateAgentCVKey();
            if (nextKey && nextKey !== currentKey) {
                currentKey = nextKey;
                ai = new GoogleGenAI({ apiKey: currentKey });
                window.KeySwapManager.markSwitched();
            }
        }
    } catch (_) {}

    const maxAttempts = (typeof window !== 'undefined' && window.APIKeyLibrary && window.APIKeyLibrary.google?.gemini?.pool?.length)
        ? window.APIKeyLibrary.google.gemini.pool.length + 1
        : 2;
    let lastErr;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
            const response = await ai.models.generateContent({
                model,
                contents: { parts: [textPart] },
                config: {
                    systemInstruction,
                    responseMimeType: "application/json",
                    responseSchema: fullAnalysisSchema,
                    temperature: 0.3,
                },
            });
            if (window.KeySwapManager) window.KeySwapManager.recordRequest({ tokensEstimated: 0 });

            const jsonText = response.text.trim();
            const result = JSON.parse(jsonText);
            if (!result.extractedCv || !result.analysis) {
                throw new Error("Phản hồi từ AI không có định dạng như mong đợi.");
            }
            return result;
        } catch (error) {
            lastErr = error;
            const msg = String(error?.message || '').toLowerCase();
            const status = error?.status || error?.response?.status || 0;
            const quotaLike = msg.includes('quota') || msg.includes('exceed') || status === 429;
            const authLike = msg.includes('api key') || msg.includes('unauthorized') || msg.includes('permission') || status === 401 || status === 403;
            if ((quotaLike || authLike) && attempt < maxAttempts) {
                const nextKey = rotateAgentCVKey();
                if (nextKey && nextKey !== currentKey) {
                    currentKey = nextKey;
                    ai = new GoogleGenAI({ apiKey: currentKey });
                    if (window.KeySwapManager) window.KeySwapManager.markSwitched();
                    continue;
                }
            }
            break;
        }
    }
    console.error("Lỗi khi gọi Gemini API:", lastErr);
    throw new Error("Không thể phân tích CV từ DOCX. Vui lòng thử lại hoặc kiểm tra cấu hình AI và hạn mức API.");
}

// --- RENDER FUNCTIONS ---
function renderCVEditor() {
  if (!state.cvData) return;
  const { fullName, email, phone, linkedin, summary, experience, education, skills } = state.cvData;
  DOMElements.cvEditor.innerHTML = `
      <div class="space-y-6">
        <div>
          <h2 class="text-xl font-bold text-slate-100">Thông tin CV của bạn</h2>
          <p class="mt-1 text-sm text-slate-400">Đây là thông tin AI trích xuất được. Bạn có thể chỉnh sửa nếu cần.</p>
        </div>
        
        <div class="space-y-4 border border-slate-600 rounded-lg p-4">
            <h3 class="font-semibold text-lg flex items-center gap-2 text-slate-200"><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-6 h-6 text-blue-400"><circle cx="12" cy="12" r="10"></circle><circle cx="12" cy="10" r="3"></circle><path d="M7 20.662V19a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v1.662"></path></svg>Thông tin cá nhân</h3>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div><label class="block text-sm font-medium text-slate-300">Họ và tên</label><input data-field="fullName" type="text" value="${fullName}" class="cv-input input-dark mt-1 block w-full px-3 py-2 rounded-md shadow-sm sm:text-sm"></div>
                <div><label class="block text-sm font-medium text-slate-300">Email</label><input data-field="email" type="text" value="${email}" class="cv-input input-dark mt-1 block w-full px-3 py-2 rounded-md shadow-sm sm:text-sm"></div>
                <div><label class="block text-sm font-medium text-slate-300">Số điện thoại</label><input data-field="phone" type="text" value="${phone}" class="cv-input input-dark mt-1 block w-full px-3 py-2 rounded-md shadow-sm sm:text-sm"></div>
                <div><label class="block text-sm font-medium text-slate-300">LinkedIn</label><input data-field="linkedin" type="text" value="${linkedin}" class="cv-input input-dark mt-1 block w-full px-3 py-2 rounded-md shadow-sm sm:text-sm"></div>
            </div>
            <div><label class="block text-sm font-medium text-slate-300">Tóm tắt bản thân</label><textarea data-field="summary" rows="4" class="cv-input input-dark mt-1 block w-full px-3 py-2 rounded-md shadow-sm sm:text-sm">${summary}</textarea></div>
        </div>

            <div class="space-y-4 border border-slate-600 rounded-lg p-4">
            <h3 class="font-semibold text-lg flex items-center gap-2 text-slate-200"><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-6 h-6 text-blue-400"><rect width="20" height="14" x="2" y="7" rx="2" ry="2"></rect><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"></path></svg>Kinh nghiệm làm việc</h3>
                                <div id="experience-list" class="space-y-4">
                            ${experience.map((exp, index) => `
                                <div key="${index}" class="space-y-3 p-4 border border-slate-600 rounded-md relative">
                                     <button data-index="${index}" class="remove-experience-btn absolute top-2 right-2 text-slate-400"><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-5 h-5 pointer-events-none"><path d="M3 6h18"></path><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><path d="M10 11v6"></path><path d="M14 11v6"></path></svg></button>
                  <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                     <div><label class="block text-sm font-medium text-slate-300">Tên công ty</label><input data-index="${index}" data-field="company" type="text" value="${exp.company}" class="cv-experience-input input-dark mt-1 block w-full px-3 py-2 rounded-md shadow-sm sm:text-sm"></div>
                     <div><label class="block text-sm font-medium text-slate-300">Chức danh</label><input data-index="${index}" data-field="title" type="text" value="${exp.title}" class="cv-experience-input input-dark mt-1 block w-full px-3 py-2 rounded-md shadow-sm sm:text-sm"></div>
                  </div>
                  <div><label class="block text-sm font-medium text-slate-300">Mô tả công việc</label><textarea data-index="${index}" data-field="description" rows="5" class="cv-experience-input input-dark mt-1 block w-full px-3 py-2 rounded-md shadow-sm sm:text-sm">${exp.description}</textarea></div>
                </div>
              `).join('')}
            </div>
            <button id="add-experience-btn" class="text-sm font-medium text-blue-400">+ Thêm kinh nghiệm</button>
        </div>

        <div class="space-y-4 border border-slate-600 rounded-lg p-4">
           <h3 class="font-semibold text-lg flex items-center gap-2 text-slate-200"><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-6 h-6 text-blue-400"><path d="M22 10v6M2 10l10-5 10 5-10 5z"></path><path d="M6 12v5c3 3 9 3 12 0v-5"></path></svg>Học vấn</h3>
           <div><label class="block text-sm font-medium text-slate-300">Trường, chuyên ngành, bằng cấp</label><textarea data-field="education" rows="2" class="cv-input input-dark mt-1 block w-full px-3 py-2 rounded-md shadow-sm sm:text-sm">${education}</textarea></div>
        </div>

        <div class="space-y-4 border border-slate-600 rounded-lg p-4">
           <h3 class="font-semibold text-lg flex items-center gap-2 text-slate-200"><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-6 h-6 text-blue-400"><path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5"></path><path d="M9 18h6"></path><path d="M10 22h4"></path></svg>Kỹ năng</h3>
           <div><label class="block text-sm font-medium text-slate-300">Liệt kê các kỹ năng (cách nhau bởi dấu phẩy)</label><textarea data-field="skills" rows="3" class="cv-input input-dark mt-1 block w-full px-3 py-2 rounded-md shadow-sm sm:text-sm">${skills}</textarea></div>
        </div>
      </div>
  `;
  document.getElementById('add-experience-btn').addEventListener('click', handleAddExperience);
}

function renderCVPreview() {
    if (!state.cvData) return;
    const { fullName, email, phone, linkedin, summary, experience, education, skills } = state.cvData;
    DOMElements.cvPreviewContainer.innerHTML = `
        <div class="text-center pb-6 border-b-2 border-slate-600">
            <h1 class="text-4xl font-black bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">${fullName || 'Họ và Tên'}</h1>
            <div class="mt-4 flex flex-wrap justify-center items-center gap-x-6 gap-y-2 text-sm text-slate-300">
                ${email ? `<p class="flex items-center gap-2 font-medium"><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-4 h-4 text-blue-400"><rect width="20" height="16" x="2" y="4" rx="2"></rect><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"></path></svg> ${email}</p>` : ''}
                ${phone ? `<p class="flex items-center gap-2 font-medium"><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-4 h-4 text-blue-400"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path></svg> ${phone}</p>` : ''}
                ${linkedin ? `<p class="flex items-center gap-2 font-medium"><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-4 h-4 text-blue-400"><path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z"></path><rect width="4" height="12" x="2" y="9"></rect><circle cx="4" cy="4" r="2"></circle></svg> ${linkedin}</p>` : ''}
            </div>
        </div>
        <div class="mt-6">
            <h2 class="text-xl font-bold text-blue-400 border-b-2 border-blue-400/30 pb-2 mb-3">TÓM TẮT BẢN THÂN</h2>
            <p class="text-slate-200 leading-relaxed font-medium">${summary}</p>
        </div>
        <div class="mt-6">
            <h2 class="text-xl font-bold text-blue-400 border-b-2 border-blue-400/30 pb-2 mb-4">KINH NGHIỆM LÀM VIỆC</h2>
            <div class="space-y-5">
                ${experience.map(exp => `
                    <div class="flex gap-4">
                        <div class="mt-1"><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-5 h-5 text-blue-400"><rect width="20" height="14" x="2" y="7" rx="2" ry="2"></rect><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"></path></svg></div>
                        <div>
                            <h3 class="font-bold text-lg text-slate-100">${exp.title}</h3>
                            <p class="text-base font-semibold text-blue-300">${exp.company}</p>
                            <ul class="list-disc list-inside mt-3 text-slate-300 leading-relaxed space-y-2 font-medium">
                                ${exp.description.split(/[\.|\n]/).filter(d => d.trim()).map(point => `<li>${point.trim()}</li>`).join('')}
                            </ul>
                        </div>
                    </div>
                `).join('')}
            </div>
        </div>
        <div class="mt-6">
            <h2 class="text-xl font-bold text-blue-400 border-b-2 border-blue-400/30 pb-2 mb-3">HỌC VẤN</h2>
            <div class="flex gap-4">
                <div class="mt-1"><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-5 h-5 text-blue-400"><path d="M22 10v6M2 10l10-5 10 5-10 5z"></path><path d="M6 12v5c3 3 9 3 12 0v-5"></path></svg></div>
                <p class="text-slate-200 font-medium">${education}</p>
            </div>
        </div>
        <div class="mt-6">
            <h2 class="text-xl font-bold text-blue-400 border-b-2 border-blue-400/30 pb-2 mb-3">KỸ NĂNG</h2>
            <div class="flex flex-wrap gap-2">
                ${skills.split(',').map(skill => `<span class="bg-gradient-to-r from-blue-500/20 to-purple-500/20 border border-blue-400/30 text-blue-200 text-sm font-bold px-4 py-2 rounded-full">${skill.trim()}</span>`).join('')}
            </div>
        </div>
    `;
}

function renderAnalysisResult() {
    if (state.isLoading) {
        DOMElements.analysisResultContainer.innerHTML = `
          <div class="flex flex-col items-center justify-center h-full text-center p-8">
            <div class="relative">
                <svg class="animate-spin w-20 h-20 text-blue-400 spinner-glow" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                <div class="absolute -inset-4 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full blur opacity-30 animate-pulse-slow"></div>
            </div>
            <p class="mt-6 text-xl font-bold text-slate-200">AI đang phân tích CV của bạn...</p>
            <p class="text-slate-400 mt-2 font-medium">Quá trình này có thể mất vài giây. Vui lòng chờ.</p>
          </div>`;
        return;
    }
     if (state.error) {
        DOMElements.analysisResultContainer.innerHTML = `
          <div class="flex flex-col items-center justify-center h-full text-center p-8 glass border border-red-500/30 rounded-xl">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-20 h-20 text-red-400"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>
            <p class="mt-4 text-xl font-bold text-red-400">LỖI PHÂN TÍCH</p>
            <p class="text-red-300 font-medium">${state.error}</p>
          </div>`;
          return;
    }
    if (!state.analysisResult) {
        DOMElements.analysisResultContainer.innerHTML = `
           <div class="flex flex-col items-center justify-center h-full text-center p-8">
             <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-20 h-20 text-slate-400"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"></path><polyline points="14 2 14 8 20 8"></polyline><path d="m9 15 2 2 4-4"></path></svg>
             <p class="mt-4 text-xl font-bold text-slate-300">CHƯA CÓ PHÂN TÍCH</p>
             <p class="text-slate-400 font-medium">Nhấn "Phân tích lại" để nhận đánh giá từ AI.</p>
           </div>
        `;
        return;
    }

    const { generalAnalysis, detailedCorrections, enhancementSuggestions, rewrittenContent } = state.analysisResult;
    DOMElements.analysisResultContainer.innerHTML = `
        <div class="space-y-8">
            <div class="flex justify-between items-center">
                <h2 class="text-3xl font-black flex items-center gap-3"><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-8 h-8 text-blue-400"><path d="M12 3L9.5 8.5L4 11L9.5 13.5L12 19L14.5 13.5L20 11L14.5 8.5L12 3Z"></path><path d="M5 3v4"></path><path d="M19 3v4"></path><path d="M3 5h4"></path><path d="M17 5h4"></path><path d="M5 21v-4"></path><path d="M19 21v-4"></path><path d="M3 19h4"></path><path d="M17 19h4"></path></svg>KẾT QUẢ PHÂN TÍCH TỪ AI</h2>
                <button id="apply-suggestions-btn" class="text-white font-bold py-3 px-6 rounded-lg">ÁP DỤNG ĐỀ XUẤT</button>
            </div>
            
            <div class="space-y-6">
                <h3 class="font-bold text-xl text-blue-400 border-b border-blue-400/30 pb-2">PHÂN TÍCH TỔNG QUAN</h3>
                <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div class="border border-green-500/30 p-6 rounded-xl">
                        <h4 class="font-black text-lg text-green-400 mb-4">ĐIỂM MẠNH</h4>
                        <ul class="list-disc list-inside space-y-2 text-slate-200 font-medium">${generalAnalysis.strengths.map(item => `<li class="leading-relaxed">${item}</li>`).join('')}</ul>
                    </div>
                     <div class="glass border border-yellow-500/30 p-6 rounded-xl">
                        <h4 class="font-black text-lg text-yellow-400 mb-4">ĐIỂM CẦN CẢI THIỆN</h4>
                        <ul class="list-disc list-inside space-y-2 text-slate-200 font-medium">${generalAnalysis.weaknesses.map(item => `<li class="leading-relaxed">${item}</li>`).join('')}</ul>
                    </div>
                </div>
            </div>

            <div class="space-y-6">
                <h3 class="font-bold text-xl text-blue-400 border-b border-blue-400/30 pb-2">VIẾT LẠI NỘI DUNG</h3>
                     <div class="space-y-4 border border-purple-500/30 p-6 rounded-xl">
                     <h4 class="font-black text-lg text-purple-400">TÓM TẮT BẢN THÂN (ĐÃ TỐI ƯU)</h4>
                     <p class="text-slate-200 font-medium italic border-l-4 border-blue-400 pl-4 leading-relaxed">${rewrittenContent.summary}</p>
                </div>
                 <div class="space-y-4 glass border border-purple-500/30 p-6 rounded-xl">
                     <h4 class="font-black text-lg text-purple-400">KINH NGHIỆM LÀM VIỆC (ĐÃ TỐI ƯU)</h4>
                     ${rewrittenContent.experience.map(exp => `
                         <div class="pt-4 border-t border-slate-600">
                             <p class="text-slate-400 line-through font-medium">Gốc: ${exp.original}</p>
                             <p class="text-slate-200 mt-2 font-medium italic border-l-4 border-blue-400 pl-4 leading-relaxed">${exp.rewritten}</p>
                         </div>
                     `).join('')}
                </div>
            </div>

            <div class="space-y-6">
                <h3 class="font-bold text-xl text-blue-400 border-b border-blue-400/30 pb-2">ĐỀ XUẤT BỔ SUNG</h3>
                <div class="p-6 border border-blue-500/30 rounded-xl">
                    <p class="text-slate-300 font-medium mb-4">Hãy cân nhắc thêm các mục sau vào CV để tăng tính chuyên nghiệp:</p>
                    <div class="space-y-4">
                        <div><h4 class="font-black text-blue-400">KỸ NĂNG:</h4><p class="text-slate-200 font-medium">${enhancementSuggestions.skills.join(', ')}</p></div>
                        <div><h4 class="font-black text-blue-400">TỪ KHÓA:</h4><p class="text-slate-200 font-medium">${enhancementSuggestions.keywords.join(', ')}</p></div>
                        <div><h4 class="font-black text-blue-400">DỰ ÁN:</h4><ul class="list-disc list-inside mt-2 text-slate-200 space-y-1 font-medium">${enhancementSuggestions.projects.map(item => `<li class="leading-relaxed">${item}</li>`).join('')}</ul></div>
                    </div>
                </div>
            </div>

             <div class="space-y-6">
                <h3 class="font-bold text-xl text-blue-400 border-b border-blue-400/30 pb-2">CHỈNH SỬA CHI TIẾT</h3>
                <div class="space-y-4">
                    ${detailedCorrections.map(item => `
                        <div class="p-4 border border-slate-600 rounded-xl">
                            <p class="text-red-400 line-through font-medium">Gốc: ${item.original}</p>
                            <p class="text-green-400 mt-2 font-medium">Đề xuất: ${item.suggestion}</p>
                        </div>
                    `).join('')}
                </div>
            </div>
        </div>
    `;
    document.getElementById('apply-suggestions-btn').addEventListener('click', handleApplySuggestions);
}

function updateUI() {
    // Loading state for re-analyze button in main view
    if (state.isLoading) {
         DOMElements.reanalyzeButton.disabled = true;
         DOMElements.reanalyzeButtonLoading.classList.remove('hidden');
         DOMElements.reanalyzeButtonText.classList.add('hidden');
    } else {
         DOMElements.reanalyzeButton.disabled = false;
         DOMElements.reanalyzeButtonLoading.classList.add('hidden');
         DOMElements.reanalyzeButtonText.classList.remove('hidden');
    }

    // Error message
    if (state.error) {
        DOMElements.errorMessage.textContent = state.error;
        DOMElements.errorMessage.classList.remove('hidden');
    } else {
        DOMElements.errorMessage.classList.add('hidden');
    }

    // DOCX file preview
    if (state.docxFile.file) {
        if (DOMElements.docxFilename) DOMElements.docxFilename.textContent = state.docxFile.file.name || 'CV.docx';
        if (DOMElements.docxPreviewWrapper) DOMElements.docxPreviewWrapper.classList.remove('hidden');
        DOMElements.imagePreviewWrapper.classList.add('hidden');
        DOMElements.dropZone.classList.add('hidden');
    } else {
        if (DOMElements.docxPreviewWrapper) DOMElements.docxPreviewWrapper.classList.add('hidden');
        DOMElements.dropZone.classList.remove('hidden');
        DOMElements.imagePreviewWrapper.classList.add('hidden');
    }

    // View switching and loading indicators
    if (state.cvData) {
        DOMElements.uploadView.classList.add('hidden');
        DOMElements.mainView.classList.remove('hidden');
        DOMElements.mainView.classList.add('grid');
        renderCVEditor();
        renderCVPreview();
        renderAnalysisResult();
        updateTabs();
        if (DOMElements.downloadDocxButton) DOMElements.downloadDocxButton.disabled = false;
    } else {
        DOMElements.uploadView.classList.remove('hidden');
        DOMElements.mainView.classList.add('hidden');
        DOMElements.mainView.classList.remove('grid');
        
        if (state.isLoading) {
            DOMElements.uploadContent.classList.add('hidden');
            DOMElements.uploadLoading.classList.remove('hidden');
            DOMElements.uploadLoading.classList.add('flex');
        } else {
            DOMElements.uploadContent.classList.remove('hidden');
            DOMElements.uploadLoading.classList.add('hidden');
            DOMElements.uploadLoading.classList.remove('flex');
        }
        if (DOMElements.downloadDocxButton) DOMElements.downloadDocxButton.disabled = true;
    }
}

function updateTabs() {
    if (state.activeTab === 'preview') {
        DOMElements.previewTab.classList.add('tab-active');
        DOMElements.previewTab.classList.remove('tab-inactive');
        DOMElements.analysisTab.classList.remove('tab-active');
        DOMElements.analysisTab.classList.add('tab-inactive');
        
        DOMElements.cvPreviewContainer.classList.remove('hidden');
        DOMElements.analysisResultContainer.classList.add('hidden');
    } else { // analysis tab
        DOMElements.analysisTab.classList.add('tab-active');
        DOMElements.analysisTab.classList.remove('tab-inactive');
        DOMElements.previewTab.classList.remove('tab-active');
        DOMElements.previewTab.classList.add('tab-inactive');

        DOMElements.cvPreviewContainer.classList.add('hidden');
        DOMElements.analysisResultContainer.classList.remove('hidden');
    }
}

// --- EVENT HANDLERS ---
function handleFileSelectDocx(file) {
    if (!file || !(file.name?.toLowerCase().endsWith('.docx') || file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document')) {
        state.error = 'Vui lòng chỉ tải lên tệp DOCX.';
        updateUI();
        return;
    }
    const reader = new FileReader();
    reader.onload = async () => {
        try {
            const arrayBuffer = reader.result;
            if (!window.mammoth || !window.mammoth.extractRawText) {
                state.error = 'Thiếu thư viện đọc DOCX. Vui lòng kiểm tra kết nối mạng.';
                updateUI();
                return;
            }
            const { value } = await window.mammoth.extractRawText({ arrayBuffer });
            state.docxFile.file = file;
            state.docxFile.text = value || '';
            state.error = null;
            handleAnalyzeDocx();
        } catch (e) {
            console.error('DOCX parse error:', e);
            state.error = 'Không thể đọc nội dung DOCX. Vui lòng thử lại.';
            updateUI();
        }
    };
    reader.readAsArrayBuffer(file);
}

async function handleAnalyzeDocx() {
    if (!ai) {
         state.error = "Trợ lý AI chưa được định cấu hình đúng cách. Vui lòng kiểm tra bảng điều khiển để biết chi tiết.";
         state.isLoading = false;
         // Reset DOCX on config error to allow retry
         state.docxFile = { file: null, text: null };
         updateUI();
         return;
    }
    if (!state.docxFile.file || !state.docxFile.text) {
        state.error = 'Vui lòng tải lại file DOCX CV của bạn.';
        state.cvData = null;
        updateUI();
        return;
    }
    state.isLoading = true;
    state.error = null;
    state.analysisResult = null;
    if (state.cvData) {
        state.activeTab = 'analysis';
    }
    updateUI();
    if (state.activeTab === 'analysis') {
        renderAnalysisResult(); 
    }

    try {
        const result = await analyzeDocxText(state.docxFile.text);
        state.analysisResult = result.analysis;
        state.cvData = result.extractedCv;
        if (!state.cvData.experience) state.cvData.experience = [];
        
        state.activeTab = 'analysis';

    } catch (e) {
        state.error = e.message;
        if (!state.cvData) {
            state.docxFile = { file: null, text: null };
        }
    } finally {
        state.isLoading = false;
        updateUI();
    }
}

function handleAddExperience() {
  state.cvData.experience.push({ company: '', title: '', description: '' });
  renderCVEditor();
  renderCVPreview();
}

function handleRemoveExperience(index) {
  state.cvData.experience.splice(index, 1);
  renderCVEditor();
  renderCVPreview();
}

function handleApplySuggestions() {
    if (!state.analysisResult || !state.analysisResult.rewrittenContent || !state.cvData) return;
    const { summary, experience: rewrittenExps } = state.analysisResult.rewrittenContent;

    const updatedExperience = state.cvData.experience.map((exp) => {
        // Find a rewritten block by matching the original description.
        const rewrittenExp = rewrittenExps.find(r => r.original && r.original.trim().includes(exp.description.trim()));
        return rewrittenExp ? { ...exp, description: rewrittenExp.rewritten } : exp;
    });

    state.cvData.summary = summary || state.cvData.summary;
    state.cvData.experience = updatedExperience;
    
    state.activeTab = 'preview';
    updateUI();
}

function handleCVDataUpdate(e) {
    const { field, index } = e.target.dataset;
    if (e.target.classList.contains('cv-input')) {
        state.cvData[field] = e.target.value;
    } else if (e.target.classList.contains('cv-experience-input')) {
        state.cvData.experience[index][field] = e.target.value;
    }
    renderCVPreview();
}

function handleRemoveImage() {
    state.cvImage = { file: null, preview: null };
    DOMElements.fileInput.value = '';
    updateUI();
}

function handleRemoveDocx() {
    state.docxFile = { file: null, text: null };
    DOMElements.fileInput.value = '';
    updateUI();
}

// --- INITIALIZATION ---
function init() {
    // Initial render
    updateUI();

    // Event Listeners
    DOMElements.reanalyzeButton.addEventListener('click', handleAnalyzeDocx);

    DOMElements.dropZone.addEventListener('click', () => DOMElements.fileInput.click());
    DOMElements.fileInput.addEventListener('change', e => handleFileSelectDocx(e.target.files[0]));
    DOMElements.removeImageButton.addEventListener('click', handleRemoveImage);
    if (DOMElements.removeDocxButton) {
        DOMElements.removeDocxButton.addEventListener('click', handleRemoveDocx);
    }

    // Drag and Drop
    const dropZone = DOMElements.dropZone;
    dropZone.addEventListener('dragenter', e => { e.preventDefault(); e.stopPropagation(); dropZone.classList.add('border-blue-500', 'bg-blue-50'); });
    dropZone.addEventListener('dragleave', e => { e.preventDefault(); e.stopPropagation(); dropZone.classList.remove('border-blue-500', 'bg-blue-50'); });
    dropZone.addEventListener('dragover', e => { e.preventDefault(); e.stopPropagation(); });
    dropZone.addEventListener('drop', e => {
        e.preventDefault();
        e.stopPropagation();
        dropZone.classList.remove('border-blue-500', 'bg-blue-50');
        handleFileSelectDocx(e.dataTransfer.files[0]);
    });

    // Tabs
    DOMElements.previewTab.addEventListener('click', () => {
        state.activeTab = 'preview';
        updateTabs();
    });
    DOMElements.analysisTab.addEventListener('click', () => {
        state.activeTab = 'analysis';
        updateTabs();
    });

    // Event delegation for dynamic content in editor
    DOMElements.cvEditor.addEventListener('input', e => {
        if (e.target.classList.contains('cv-input') || e.target.classList.contains('cv-experience-input')) {
            handleCVDataUpdate(e);
        }
    });
    DOMElements.cvEditor.addEventListener('click', e => {
        if (e.target.classList.contains('remove-experience-btn') || e.target.parentElement.classList.contains('remove-experience-btn')) {
           const button = e.target.closest('.remove-experience-btn');
           handleRemoveExperience(parseInt(button.dataset.index, 10));
        }
    });
}

document.addEventListener('DOMContentLoaded', init);

// --- DOCX EXPORT ---
function generateDocxHtml(cv) {
    const safe = (v) => (v || '').toString();
    const expBlocks = (cv.experience || []).map(exp => {
        const points = safe(exp.description).split(/[\.\n]/).filter(d => d.trim());
        return `
        <div style="margin-bottom:12px;">
            <div style="font-weight:700;">${safe(exp.title)} — ${safe(exp.company)}</div>
            ${points.length ? `<ul style="margin:6px 0 0 18px;">${points.map(p => `<li>${p.trim()}</li>`).join('')}</ul>` : ''}
        </div>`;
    }).join('');

    const skills = safe(cv.skills).split(',').map(s => s.trim()).filter(Boolean);

    return `<!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8"/>
        <title>CV</title>
        <style>
            body{font-family:Arial,Helvetica,sans-serif; font-size:12pt; color:#000;}
            h1{font-size:24pt; margin:0 0 6pt 0;}
            h2{font-size:14pt; margin:16pt 0 6pt 0;}
            p{margin:6pt 0;}
            .contact{font-size:10pt; color:#333;}
            .section{margin-top:10pt;}
        </style>
    </head>
    <body>
        <h1>${safe(cv.fullName) || 'Họ và Tên'}</h1>
        <p class="contact">${safe(cv.email)}${cv.email && cv.phone ? ' • ' : ''}${safe(cv.phone)}${(cv.email||cv.phone) && cv.linkedin ? ' • ' : ''}${safe(cv.linkedin)}</p>
        <div class="section">
            <h2>Tóm tắt bản thân</h2>
            <p>${safe(cv.summary)}</p>
        </div>
        <div class="section">
            <h2>Kinh nghiệm làm việc</h2>
            ${expBlocks}
        </div>
        <div class="section">
            <h2>Học vấn</h2>
            <p>${safe(cv.education)}</p>
        </div>
        <div class="section">
            <h2>Kỹ năng</h2>
            ${skills.length ? `<ul style="margin:6px 0 0 18px;">${skills.map(s => `<li>${s}</li>`).join('')}</ul>` : '<p></p>'}
        </div>
    </body>
    </html>`;
}

function handleDownloadDocx() {
    try {
        if (!state.cvData) {
            state.error = 'Chưa có nội dung CV để xuất ra DOCX.';
            updateUI();
            return;
        }
        if (!window.htmlDocx || !window.htmlDocx.asBlob) {
            state.error = 'Thiếu thư viện chuyển đổi DOCX. Vui lòng kiểm tra kết nối mạng.';
            updateUI();
            return;
        }
        const html = generateDocxHtml(state.cvData);
        const blob = window.htmlDocx.asBlob(html);
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        const namePart = (state.cvData.fullName || 'CV').replace(/[^a-zA-Z0-9_\- ]/g, '').trim() || 'CV';
        a.href = url;
        a.download = `${namePart}.docx`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(url), 5000);
    } catch (e) {
        console.error('DOCX export error:', e);
        state.error = 'Xuất DOCX thất bại. Vui lòng thử lại.';
        updateUI();
    }
}

// Attach after init is defined
const _origInit = init;
init = function() {
    _origInit();
    if (DOMElements.downloadDocxButton) {
        DOMElements.downloadDocxButton.addEventListener('click', handleDownloadDocx);
        DOMElements.downloadDocxButton.disabled = !state.cvData;
    }
};
