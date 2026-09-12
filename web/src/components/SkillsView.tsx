import React, { useState, useMemo } from 'react';
import {
  Search,
  Filter,
  Shield,
  Zap,
  Terminal,
  CheckCircle2,
  Copy,
  ExternalLink,
  Cpu,
  Layers,
  Sparkles,
  ChevronRight,
  Award,
  Play,
  Check,
  Flame,
  Code,
  AlertTriangle,
} from 'lucide-react';
import rawSkillsData from '../skills_data.json';

interface SkillItem {
  id: string;
  name: string;
  category: string;
  category_en?: string;
  icon?: string;
  desc?: string;
  path?: string;
  script_count?: number;
  tags?: string[];
  scripts?: string[];
  risk?: string;
  content_preview?: string;
}

const CATEGORY_MAP: Record<string, { en: string; icon: string; desc: string }> = {
  '全部': { en: 'all', icon: '⚔️', desc: '全量 181 项网络战斗实战技能武器' },
  'Linux提权类': { en: 'linux-privesc', icon: '🐧', desc: 'Linux 内核、SUID、Sudo、容器逃逸与提权链' },
  'Web攻击类': { en: 'web-attack', icon: '🌐', desc: 'SQL注入、XSS、SSRF、CSRF、逻辑漏洞与认证绕过' },
  'Windows-AD攻击类': { en: 'windows-ad', icon: '🪟', desc: 'Active Directory、Kerberos、域横向移动与哈希传递' },
  '云平台攻击类': { en: 'cloud-security', icon: '☁️', desc: 'AWS、Azure、GCP、IAM 权限提升与元数据渗透' },
  '免杀规避类': { en: 'evasion', icon: '🥷', desc: 'EDR/沙箱规避、内存加载、混淆与白名单利用' },
  '利用类-漏洞利用': { en: 'exploit', icon: '💥', desc: '二进制漏洞利用、ROP链构造、Webshell与内存马' },
  '探测类-侦察信息收集': { en: 'recon', icon: '🔍', desc: '资产发现、端口扫描、子域名与指纹识别' },
  '数据渗出类': { en: 'exfil', icon: '📤', desc: 'DNS信道、ICMP隧道、加密渗出与隐蔽传输' },
  '辅助类-工程与提效': { en: 'devops', icon: '⚙️', desc: '自动化编排、代理池管理与武器库快速流水线' },
  '辅助类-智能体协作': { en: 'agentic', icon: '🤖', desc: '多智能体协同、状态共享与自适应提示词工程' },
  '辅助类-逆向工程': { en: 'reverse', icon: '🔬', desc: '反编译、动态调试、混淆脱壳与符号恢复' },
  '辅助类-隐蔽通信': { en: 'c2', icon: '📡', desc: 'C2通信协议、自定义流量伪装与域前置' },
  '防御规避类': { en: 'defense-evasion', icon: '🛡️', desc: '日志清除、行为伪装与反取证对抗' },
  '密码学攻击': { en: 'crypto', icon: '🔐', desc: '弱加密破解、Padding Oracle与秘钥恢复' },
  '移动安全': { en: 'mobile', icon: '📱', desc: 'Android/iOS 应用反编译、Frida Hook 与漏洞分析' },
  '容器与K8s安全': { en: 'container', icon: '📦', desc: 'Docker/K8s 容器逃逸、RBAC 提权与集群渗透' },
  'AI安全与对抗': { en: 'ai-sec', icon: '🧠', desc: 'Prompt 注入、模型越狱与 Agent 投毒防御' },
};

// Flatten skills from json
function parseSkills(): SkillItem[] {
  const result: SkillItem[] = [];
  const raw = rawSkillsData as any;
  if (!raw || !raw.categories) return [];

  Object.entries(raw.categories).forEach(([catName, catData]: [string, any]) => {
    const list = Array.isArray(catData.skills) ? catData.skills : [];
    list.forEach((skill: any, index: number) => {
      result.push({
        id: skill.id || `${catData.en || 'skill'}-${index}`,
        name: skill.name || '未命名技能',
        category: catName,
        category_en: catData.en,
        icon: catData.icon || '⚔️',
        desc: skill.desc || catData.desc || '网络安全实战自动化执行技能',
        path: skill.path || '',
        script_count: skill.script_count || (skill.scripts ? skill.scripts.length : 1),
        tags: skill.tags || [catName, catData.en || 'security'],
        scripts: skill.scripts || ['main.py', 'exploit.sh', 'recon.sh'],
        risk: skill.risk || (catName.includes('利用') ? 'HIGH' : catName.includes('提权') ? 'CRITICAL' : 'MEDIUM'),
        content_preview: skill.content_preview || `# 自动化执行脚本: ${skill.name}\nimport sys\n# 技能装配完成，随时接受策略官调度\ndef run():\n    print("[+] 技能启动: ${skill.name}")\n`,
      });
    });
  });

  return result;
}

export const SkillsView: React.FC<{
  onEquip?: (strategistId: string, skillId: string) => void;
}> = ({ onEquip }) => {
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('全部');
  const [selectedSkill, setSelectedSkill] = useState<SkillItem | null>(null);
  const [equippedSkills, setEquippedSkills] = useState<Record<string, string[]>>({
    claude: ['Linux提权类-自动化提权检查', 'Web攻击类-SQL注入自动化探测', 'Windows-AD攻击类-Kerberoasting攻击'],
    gpt: ['探测类-侦察信息收集-资产发现综合脚本', '云平台攻击类-AWS元数据渗出'],
    deepseek: ['免杀规避类-EDR白名单绕过', '利用类-漏洞利用-内存马注入'],
  });
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const allSkills = useMemo(() => parseSkills(), []);

  const filteredSkills = useMemo(() => {
    return allSkills.filter((s) => {
      const matchCat = selectedCategory === '全部' || s.category === selectedCategory;
      const matchSearch =
        !search ||
        s.name.toLowerCase().includes(search.toLowerCase()) ||
        s.desc?.toLowerCase().includes(search.toLowerCase()) ||
        s.category.toLowerCase().includes(search.toLowerCase());
      return matchCat && matchSearch;
    });
  }, [allSkills, selectedCategory, search]);

  const handleEquip = (strategistId: string, skill: SkillItem) => {
    setEquippedSkills((prev) => {
      const current = prev[strategistId] || [];
      if (current.includes(skill.name)) return prev;
      return {
        ...prev,
        [strategistId]: [...current, skill.name],
      };
    });
    const stratName = strategistId === 'claude' ? 'Claude 3.5' : strategistId === 'gpt' ? 'GPT-4o' : 'DeepSeek-V3';
    setToast(`已将「${skill.name}」装备至策略官 ${stratName}`);
    setTimeout(() => setToast(null), 3000);
    if (onEquip) {
      onEquip(strategistId, skill.id);
    }
  };

  const copyCode = (code: string, id: string) => {
    navigator.clipboard.writeText(code);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="flex-1 p-5 md:p-6 overflow-y-auto text-slate-100 space-y-5 max-w-7xl mx-auto z-10 relative">
      {/* Toast Notification */}
      {toast && (
        <div className="fixed top-5 right-5 z-50 px-4 py-3 bg-cyan-950/95 border border-cyan-500/50 rounded-xl text-cyan-200 text-xs font-medium flex items-center gap-2 shadow-2xl backdrop-blur-md animate-in fade-in slide-in-from-top-3">
          <Sparkles className="w-4 h-4 text-cyan-400" />
          {toast}
        </div>
      )}

      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800/80 pb-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-black text-white tracking-tight">实战技能武器库</h1>
                <span className="px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-300 border border-amber-500/30 text-xs font-mono font-bold">
                  {allSkills.length} SKILLS
                </span>
                <span className="px-2 py-0.5 rounded-md bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 text-xs font-mono font-bold">
                  17 分类
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                覆盖 Web、内网 AD、Linux 提权、云安全、免杀规避与智能体协同全战术链路，可实时赋能策略官。
              </p>
            </div>
          </div>
        </div>

        {/* Search Bar */}
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="搜索 181 项实战技能或关键词..."
            className="w-full bg-slate-900/90 border border-slate-700/80 rounded-xl pl-10 pr-4 py-2 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-amber-500/60 focus:ring-1 focus:ring-amber-500/30 transition-all font-mono"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 text-xs"
            >
              ×
            </button>
          )}
        </div>
      </div>

      {/* Category Pills */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-thin">
        {Object.entries(CATEGORY_MAP).map(([catName, catInfo]) => {
          const active = selectedCategory === catName;
          const count = catName === '全部' ? allSkills.length : allSkills.filter((s) => s.category === catName).length;
          return (
            <button
              key={catName}
              onClick={() => setSelectedCategory(catName)}
              className={`px-3 py-1.5 rounded-xl text-xs font-medium whitespace-nowrap transition-all flex items-center gap-1.5 border ${
                active
                  ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 shadow-sm shadow-amber-950/50'
                  : 'bg-slate-900/70 text-slate-400 border-slate-800 hover:bg-slate-800/80 hover:text-slate-200'
              }`}
            >
              <span>{catInfo.icon}</span>
              <span>{catName}</span>
              <span className={`text-[10px] font-mono px-1 rounded ${active ? 'bg-amber-500/30 text-amber-200' : 'bg-slate-800 text-slate-500'}`}>
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Skills Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredSkills.map((skill) => {
          const catInfo = CATEGORY_MAP[skill.category] || { icon: '⚔️', en: 'sec' };
          const isClaudeEq = (equippedSkills.claude || []).includes(skill.name);
          const isGptEq = (equippedSkills.gpt || []).includes(skill.name);
          const isDeepSeekEq = (equippedSkills.deepseek || []).includes(skill.name);

          return (
            <div
              key={skill.id}
              className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 hover:border-slate-700/80 hover:bg-slate-900/95 transition-all group flex flex-col justify-between shadow-md"
            >
              <div>
                <div className="flex items-start justify-between gap-2 mb-2.5">
                  <div className="flex items-center gap-2">
                    <span className="text-lg p-1.5 rounded-lg bg-slate-800 border border-slate-700/60">
                      {catInfo.icon}
                    </span>
                    <div>
                      <h3 className="text-sm font-bold text-slate-100 group-hover:text-amber-300 transition-colors line-clamp-1">
                        {skill.name}
                      </h3>
                      <span className="text-[10px] font-mono text-slate-500">{skill.category}</span>
                    </div>
                  </div>
                  <span
                    className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded border ${
                      skill.risk === 'CRITICAL'
                        ? 'bg-rose-500/10 text-rose-300 border-rose-500/30'
                        : skill.risk === 'HIGH'
                        ? 'bg-amber-500/10 text-amber-300 border-amber-500/30'
                        : 'bg-cyan-500/10 text-cyan-300 border-cyan-500/30'
                    }`}
                  >
                    {skill.risk}
                  </span>
                </div>

                <p className="text-xs text-slate-400 line-clamp-2 mb-3 leading-relaxed">
                  {skill.desc}
                </p>

                {/* Equipped Badges */}
                <div className="flex flex-wrap gap-1 mb-3">
                  {isClaudeEq && (
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-purple-500/10 text-purple-300 border border-purple-500/30 flex items-center gap-1">
                      <Check className="w-2.5 h-2.5" /> Claude 装备
                    </span>
                  )}
                  {isGptEq && (
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
                      <Check className="w-2.5 h-2.5" /> GPT-4o 装备
                    </span>
                  )}
                  {isDeepSeekEq && (
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-300 border border-blue-500/30 flex items-center gap-1">
                      <Check className="w-2.5 h-2.5" /> DeepSeek 装备
                    </span>
                  )}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between gap-2">
                <button
                  onClick={() => setSelectedSkill(skill)}
                  className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-medium flex items-center gap-1 transition-colors"
                >
                  <Code className="w-3.5 h-3.5 text-slate-400" />
                  详情脚本
                </button>

                <div className="flex items-center gap-1">
                  <button
                    onClick={() => handleEquip('claude', skill)}
                    title="装备至 Claude 3.5 策略官"
                    className="p-1.5 rounded-lg bg-purple-950/40 hover:bg-purple-900/60 border border-purple-500/30 text-purple-300 text-xs font-mono transition-colors"
                  >
                    Claude
                  </button>
                  <button
                    onClick={() => handleEquip('gpt', skill)}
                    title="装备至 GPT-4o 战术官"
                    className="p-1.5 rounded-lg bg-emerald-950/40 hover:bg-emerald-900/60 border border-emerald-500/30 text-emerald-300 text-xs font-mono transition-colors"
                  >
                    GPT
                  </button>
                  <button
                    onClick={() => handleEquip('deepseek', skill)}
                    title="装备至 DeepSeek-V3 推理官"
                    className="p-1.5 rounded-lg bg-blue-950/40 hover:bg-blue-900/60 border border-blue-500/30 text-blue-300 text-xs font-mono transition-colors"
                  >
                    DeepSeek
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Skill Detail Modal */}
      {selectedSkill && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
          <div className="w-full max-w-2xl bg-slate-900 border border-slate-700/80 rounded-2xl p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between gap-4 border-b border-slate-800 pb-3">
              <div className="flex items-center gap-3">
                <span className="text-2xl p-2 rounded-xl bg-slate-800 border border-slate-700">
                  {CATEGORY_MAP[selectedSkill.category]?.icon || '⚔️'}
                </span>
                <div>
                  <h2 className="text-lg font-bold text-white">{selectedSkill.name}</h2>
                  <p className="text-xs text-slate-400 font-mono">
                    分类: {selectedSkill.category} ({selectedSkill.category_en})
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedSkill(null)}
                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white"
              >
                ×
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <h4 className="text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
                  技能描述与作战意图
                </h4>
                <p className="text-xs text-slate-300 bg-slate-950/60 p-3 rounded-xl border border-slate-800 leading-relaxed font-mono">
                  {selectedSkill.desc}
                </p>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <h4 className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                    自动化执行脚本与调用载荷
                  </h4>
                  <button
                    onClick={() => copyCode(selectedSkill.content_preview || '', selectedSkill.id)}
                    className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-[11px] text-slate-300 flex items-center gap-1"
                  >
                    {copiedId === selectedSkill.id ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                    {copiedId === selectedSkill.id ? '已复制' : '复制脚本'}
                  </button>
                </div>
                <pre className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 text-xs font-mono text-emerald-400 overflow-x-auto">
                  {selectedSkill.content_preview || `# 技能: ${selectedSkill.name}\n# 路径: ${selectedSkill.path}\n# 已加载至天宫武器注册表`}
                </pre>
              </div>

              <div>
                <h4 className="text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                  一键装备至策略官
                </h4>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    onClick={() => handleEquip('claude', selectedSkill)}
                    className="p-2.5 rounded-xl bg-purple-950/30 hover:bg-purple-900/50 border border-purple-500/30 text-purple-300 text-xs font-bold flex items-center justify-center gap-1.5"
                  >
                    <Award className="w-4 h-4 text-purple-400" />
                    Claude 3.5 Sonnet
                  </button>
                  <button
                    onClick={() => handleEquip('gpt', selectedSkill)}
                    className="p-2.5 rounded-xl bg-emerald-950/30 hover:bg-emerald-900/50 border border-emerald-500/30 text-emerald-300 text-xs font-bold flex items-center justify-center gap-1.5"
                  >
                    <Award className="w-4 h-4 text-emerald-400" />
                    GPT-4o
                  </button>
                  <button
                    onClick={() => handleEquip('deepseek', selectedSkill)}
                    className="p-2.5 rounded-xl bg-blue-950/30 hover:bg-blue-900/50 border border-blue-500/30 text-blue-300 text-xs font-bold flex items-center justify-center gap-1.5"
                  >
                    <Award className="w-4 h-4 text-blue-400" />
                    DeepSeek-V3
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
