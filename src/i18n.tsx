import { createContext, useContext, useMemo, useState, type ReactNode } from 'react'
import type { FeedState, PathKind, RouteKind } from './types'

export type Language = 'zh' | 'en'
const STORAGE_KEY = 'tracescope.lang'
const englishBrowser = () => /^en\b/i.test(navigator.language)

function resolveInitial(): Language {
  const stored = localStorage.getItem(STORAGE_KEY)
  if (stored === 'zh' || stored === 'en') return stored
  return englishBrowser() ? 'en' : 'zh'
}

const messages = {
  zh: {
    brandTagline: '本机网络路径可视化',
    visibleRoutes: '条可视线路',
    eyebrow: 'NETWORK FLOW CONSOLE',
    panelTitle: '实时网络连接',
    connectLive: '连接本机实时服务',
    disconnectLive: '断开实时服务',
    localLocation: '本机位置：',
    localConfig: '（本地配置）',
    geoipOutbound: 'GeoIP 外发',
    privacyText: '本机物理位置来自本地配置，不由公网 IP 推断，也不会发送给 GeoIP 服务。服务仅监听 127.0.0.1，不向网页发送本地源 IP 或 controller secret。公网目标 IP 与代理/VPN 公网出口会发送给 ipwho.is 定位；需解析域名时，域名会发送给 Cloudflare DoH。',
    metricCollected: '采集连接',
    metricGlobe: '地球线路',
    metricMax: '最多',
    metricLogical: '逻辑路径',
    metricPaths: '条',
    pauseSignals: '暂停信号动画',
    resumeSignals: '继续信号动画',
    pauseHint: '暂停不影响后台采集',
    signalSpeed: '信号速度',
    routesHeading: '线路与连接',
    locatableNodes: '个可定位节点',
    traceQueued: 'Trace 排队',
    traceUnavailable: 'Trace 无响应',
    routeKindDirect: '直连',
    routeKindProxy: '代理',
    routeKindVpn: 'VPN',
    pathTrace: '真实 Trace',
    pathLogicalDirect: '逻辑直连',
    pathLogicalProxy: '逻辑代理路径',
    pathLogicalVpn: '逻辑 VPN 路径',
    hops: '跳',
    detailTitle: '连接详情',
    detailHint: '点击任意线路查看本机、出口、目标和路径性质',
    origin: '本机',
    proxyEgress: '代理出口',
    vpnEgress: 'VPN 出口',
    target: '目标',
    type: '类型',
    path: '路径',
    rtt: 'RTT',
    noProxyChain: '无代理链',
    unknownProcess: '进程未知',
    unknownRule: '规则未知',
    attribution: '拖拽旋转 · 滚轮缩放 · 连接实时更新',
    autoRotate: '自动旋转',
    resetView: '复位视角',
    langSwitch: 'EN',
  },
  en: {
    brandTagline: 'Local network path visualization',
    visibleRoutes: 'visible routes',
    eyebrow: 'NETWORK FLOW CONSOLE',
    panelTitle: 'Live network connections',
    connectLive: 'Connect to local live service',
    disconnectLive: 'Disconnect live service',
    localLocation: 'Local location: ',
    localConfig: ' (local config)',
    geoipOutbound: 'GeoIP outbound',
    privacyText: 'Your physical location comes from local config, not inferred from your public IP, and is never sent to a GeoIP service. The service only listens on 127.0.0.1 and never sends your local source IP or controller secret to the page. Public target IPs and proxy/VPN egress are sent to ipwho.is for geolocation; when a hostname must be resolved it is sent to Cloudflare DoH.',
    metricCollected: 'Connections collected',
    metricGlobe: 'Globe routes',
    metricMax: 'max',
    metricLogical: 'Logical paths',
    metricPaths: 'paths',
    pauseSignals: 'Pause signal animation',
    resumeSignals: 'Resume signal animation',
    pauseHint: 'Pausing does not affect background collection',
    signalSpeed: 'Signal speed',
    routesHeading: 'Routes & connections',
    locatableNodes: 'locatable nodes',
    traceQueued: 'Trace queued',
    traceUnavailable: 'Trace unavailable',
    routeKindDirect: 'Direct',
    routeKindProxy: 'Proxy',
    routeKindVpn: 'VPN',
    pathTrace: 'Real trace',
    pathLogicalDirect: 'Logical direct',
    pathLogicalProxy: 'Logical proxy path',
    pathLogicalVpn: 'Logical VPN path',
    hops: 'hops',
    detailTitle: 'Connection details',
    detailHint: 'Click any route to view local, egress, target and path',
    origin: 'Local',
    proxyEgress: 'Proxy egress',
    vpnEgress: 'VPN egress',
    target: 'Target',
    type: 'Type',
    path: 'Path',
    rtt: 'RTT',
    noProxyChain: 'No proxy chain',
    unknownProcess: 'Unknown process',
    unknownRule: 'Unknown rule',
    attribution: 'Drag to rotate · Scroll to zoom · Live updates',
    autoRotate: 'Auto-rotate',
    resetView: 'Reset view',
    langSwitch: '中文',
  },
} as const
type MessageKey = keyof typeof messages.zh

export const stateText: Record<FeedState, { zh: string; en: string }> = {
  connecting: { zh: '正在连接', en: 'Connecting' },
  live: { zh: '实时', en: 'Live' },
  reconnecting: { zh: '正在重连', en: 'Reconnecting' },
  offline: { zh: '已断开', en: 'Offline' },
}
export const routeKindText: Record<RouteKind, { zh: string; en: string }> = {
  direct: { zh: '直连', en: 'Direct' },
  proxy: { zh: '代理', en: 'Proxy' },
  vpn: { zh: 'VPN', en: 'VPN' },
}
export const pathKindText: Record<PathKind, { zh: string; en: string }> = {
  trace: { zh: '真实 Trace', en: 'Real trace' },
  'logical-direct': { zh: '逻辑直连', en: 'Logical direct' },
  'logical-proxy': { zh: '逻辑代理路径', en: 'Logical proxy path' },
  'logical-vpn': { zh: '逻辑 VPN 路径', en: 'Logical VPN path' },
}

const CITY_ZH: Record<string, string> = {
  Shanghai: '上海', Beijing: '北京', Guangzhou: '广州', Shenzhen: '深圳', Chengdu: '成都',
  Hangzhou: '杭州', Wuhan: '武汉', "Xi'an": '西安', Nanjing: '南京', Tianjin: '天津',
  Chongqing: '重庆', Suzhou: '苏州', 'Hong Kong': '香港', Macau: '澳门', Taipei: '台北',
  Kaohsiung: '高雄', Hsinchu: '新竹', Taichung: '台中', Tokyo: '东京', Osaka: '大阪',
  Nagoya: '名古屋', Kyoto: '京都', Yokohama: '横滨', Fukuoka: '福冈', Sapporo: '札幌',
  Seoul: '首尔', Incheon: '仁川', Busan: '釜山', Singapore: '新加坡', 'Kuala Lumpur': '吉隆坡',
  Bangkok: '曼谷', Jakarta: '雅加达', Manila: '马尼拉', 'Ho Chi Minh City': '胡志明市', Hanoi: '河内',
  Mumbai: '孟买', 'New Delhi': '新德里', Delhi: '德里', Bangalore: '班加罗尔', Chennai: '金奈',
  Dhaka: '达卡', Karachi: '卡拉奇', 'Colombo': '科伦坡', Dubai: '迪拜', 'Abu Dhabi': '阿布扎比',
  Doha: '多哈', Riyadh: '利雅得', 'Tel Aviv': '特拉维夫', Istanbul: '伊斯坦布尔', Moscow: '莫斯科',
  'Saint Petersburg': '圣彼得堡', London: '伦敦', Manchester: '曼彻斯特', Paris: '巴黎', Berlin: '柏林',
  Munich: '慕尼黑', Frankfurt: '法兰克福', Hamburg: '汉堡', Amsterdam: '阿姆斯特丹', Rotterdam: '鹿特丹',
  Brussels: '布鲁塞尔', Zurich: '苏黎世', Geneva: '日内瓦', Vienna: '维也纳', Prague: '布拉格',
  Warsaw: '华沙', Madrid: '马德里', Barcelona: '巴塞罗那', Milan: '米兰', Rome: '罗马',
  Lisbon: '里斯本', Copenhagen: '哥本哈根', Stockholm: '斯德哥尔摩', Oslo: '奥斯陆', Helsinki: '赫尔辛基',
  Dublin: '都柏林', Athens: '雅典', Bucharest: '布加勒斯特', Kyiv: '基辅', 'New York': '纽约',
  'New York City': '纽约', 'Los Angeles': '洛杉矶', 'San Francisco': '旧金山', 'San Jose': '圣何塞',
  Seattle: '西雅图', Chicago: '芝加哥', Houston: '休斯顿', Dallas: '达拉斯', Austin: '奥斯汀',
  Boston: '波士顿', Washington: '华盛顿', 'Washington, D.C.': '华盛顿', Miami: '迈阿密', Atlanta: '亚特兰大',
  Denver: '丹佛', Phoenix: '凤凰城', Philadelphia: '费城', 'Las Vegas': '拉斯维加斯', 'San Diego': '圣迭戈',
  Portland: '波特兰', 'Mountain View': '山景城', 'Santa Clara': '圣克拉拉', Redmond: '雷德蒙德', Fremont: '弗里蒙特',
  Ashburn: '阿什本', Irvine: '尔湾', Toronto: '多伦多', Vancouver: '温哥华', Montreal: '蒙特利尔',
  Ottawa: '渥太华', Calgary: '卡尔加里', 'Mexico City': '墨西哥城', 'Sao Paulo': '圣保罗', 'Rio de Janeiro': '里约热内卢',
  'Buenos Aires': '布宜诺斯艾利斯', Santiago: '圣地亚哥', Bogota: '波哥大', Lima: '利马', Sydney: '悉尼',
  Melbourne: '墨尔本', Brisbane: '布里斯班', Perth: '珀斯', Auckland: '奥克兰', Wellington: '惠灵顿',
  'Cape Town': '开普敦', Johannesburg: '约翰内斯堡', Nairobi: '内罗毕', Lagos: '拉各斯', Cairo: '开罗',
  Casablanca: '卡萨布兰卡', 'Kansas City': '堪萨斯城', 'Kansas City, MO': '堪萨斯城', 'St. Louis': '圣路易斯',
  Shijiazhuang: '石家庄', Langfang: '廊坊', Baoding: '保定', Tangshan: '唐山', 'Zhangjiakou Shi': '张家口',
  Zhangjiakou: '张家口', Datong: '大同', Taiyuan: '太原', Jinan: '济南', Qingdao: '青岛', Dalian: '大连',
  Shenyang: '沈阳', Changchun: '长春', Harbin: '哈尔滨', Hefei: '合肥', Nanchang: '南昌', Changsha: '长沙',
  Zhengzhou: '郑州', Luoyang: '洛阳', Kunming: '昆明', Guiyang: '贵阳', Nanning: '南宁', Lanzhou: '兰州',
  Xining: '西宁', Yinchuan: '银川', Urumqi: '乌鲁木齐', Lhasa: '拉萨', Hohhot: '呼和浩特', Fuzhou: '福州',
  Xiamen: '厦门', Wenzhou: '温州', Ningbo: '宁波', Wuxi: '无锡', Changzhou: '常州', Xuzhou: '徐州',
  Yantai: '烟台', Weifang: '潍坊', Zibo: '淄博', Linyi: '临沂', Jilin: '吉林', Mianyang: '绵阳',
  Jinzhong: '晋中', Jinhua: '金华', Taizhou: '台州', Shaoxing: '绍兴', Jiaxing: '嘉兴', Huzhou: '湖州',
  Zhoushan: '舟山', Yiwu: '义乌', Nantong: '南通', Yangzhou: '扬州', Zhenjiang: '镇江', Huaian: '淮安',
  Yancheng: '盐城', Lianyungang: '连云港', Suqian: '宿迁', Jincheng: '晋城', Yuncheng: '运城', Linfen: '临汾',
  Changzhi: '长治', Shuozhou: '朔州', Xinzhou: '忻州', Lyuliang: '吕梁', Yangquan: '阳泉', Cangzhou: '沧州',
  Handan: '邯郸', Xingtai: '邢台', Qinhuangdao: '秦皇岛', Chengde: '承德', Chifeng: '赤峰', Ordos: '鄂尔多斯',
  Baotou: '包头', Wuhu: '芜湖', Bengbu: '蚌埠', Maanshan: '马鞍山', Anqing: '安庆', Fuyang: '阜阳',
  Huangshan: '黄山', Quanzhou: '泉州', Zhangzhou: '漳州', Putian: '莆田', Sanming: '三明', Longyan: '龙岩',
  Nanping: '南平', Ningde: '宁德', Weihai: '威海', Dezhou: '德州', Heze: '菏泽', Liaocheng: '聊城',
  Binzhou: '滨州', Dongying: '东营', Rizhao: '日照', Jining: '济宁', Zaozhuang: '枣庄', "Tai'an": '泰安',
  Zhuhai: '珠海', Foshan: '佛山', Dongguan: '东莞', Zhongshan: '中山', Huizhou: '惠州', Shantou: '汕头',
  Jiangmen: '江门', Zhanjiang: '湛江', Maoming: '茂名', Zhaoqing: '肇庆', Qingyuan: '清远', Chaozhou: '潮州',
  Jieyang: '揭阳', Shanwei: '汕尾', Heyuan: '河源', Yangjiang: '阳江', Meizhou: '梅州', Shaoguan: '韶关',
  Liuzhou: '柳州', Guilin: '桂林', Beihai: '北海', Haikou: '海口', Sanya: '三亚', Luzhou: '泸州',
  Yibin: '宜宾', Nanchong: '南充', Deyang: '德阳', Leshan: '乐山', Panzhihua: '攀枝花', Qujing: '曲靖',
  Dali: '大理', Zunyi: '遵义', Liupanshui: '六盘水', Baoji: '宝鸡', Xianyang: '咸阳', Yulin: '榆林',
  Tianshui: '天水', Jiayuguan: '嘉峪关', Yichang: '宜昌', Xiangyang: '襄阳', Huangshi: '黄石', Jingzhou: '荆州',
  Shiyan: '十堰', Xiaogan: '孝感', Jingmen: '荆门', Zhuzhou: '株洲', Xiangtan: '湘潭', Hengyang: '衡阳',
  Yueyang: '岳阳', Changde: '常德', Chenzhou: '郴州', Xinxiang: '新乡', Anyang: '安阳', Kaifeng: '开封',
  Xuchang: '许昌', Pingdingshan: '平顶山', Luohe: '漯河', Shangqiu: '商丘', Zhoukou: '周口', Zhumadian: '驻马店',
  Nanyang: '南阳', Xinyang: '信阳', Jiaozuo: '焦作', Puyang: '濮阳', Sanmenxia: '三门峡', Siping: '四平',
  Yanji: '延吉', Mudanjiang: '牡丹江', Qiqihar: '齐齐哈尔', Daqing: '大庆', Korla: '库尔勒', Kashgar: '喀什',
}
const COUNTRY_ZH: Record<string, string> = {
  China: '中国', 'United States': '美国', 'United States of America': '美国', USA: '美国',
  Japan: '日本', 'South Korea': '韩国', Korea: '韩国', 'Republic of Korea': '韩国', 'Hong Kong': '中国香港',
  Macau: '中国澳门', Taiwan: '中国台湾', 'Singapore': '新加坡', Malaysia: '马来西亚', Thailand: '泰国',
  Indonesia: '印度尼西亚', Philippines: '菲律宾', Vietnam: '越南', India: '印度', Bangladesh: '孟加拉国',
  Pakistan: '巴基斯坦', 'United Arab Emirates': '阿联酋', Qatar: '卡塔尔', 'Saudi Arabia': '沙特阿拉伯',
  Israel: '以色列', Turkey: '土耳其', Russia: '俄罗斯', 'United Kingdom': '英国', France: '法国',
  Germany: '德国', Netherlands: '荷兰', Belgium: '比利时', Switzerland: '瑞士', Austria: '奥地利',
  Czechia: '捷克', 'Czech Republic': '捷克', Poland: '波兰', Spain: '西班牙', Italy: '意大利',
  Portugal: '葡萄牙', Denmark: '丹麦', Sweden: '瑞典', Norway: '挪威', Finland: '芬兰', Ireland: '爱尔兰',
  Greece: '希腊', Romania: '罗马尼亚', Ukraine: '乌克兰', Canada: '加拿大', Mexico: '墨西哥',
  Brazil: '巴西', Argentina: '阿根廷', Chile: '智利', Colombia: '哥伦比亚', Peru: '秘鲁',
  Australia: '澳大利亚', 'New Zealand': '新西兰', 'South Africa': '南非', Kenya: '肯尼亚', Nigeria: '尼日利亚',
  Egypt: '埃及', Morocco: '摩洛哥', Iceland: '冰岛', Luxembourg: '卢森堡', Hungary: '匈牙利',
  Bulgaria: '保加利亚', Croatia: '克罗地亚', Serbia: '塞尔维亚', Slovenia: '斯洛文尼亚', Slovakia: '斯洛伐克',
  'United States Minor Outlying Islands': '美国', 'Isle of Man': '马恩岛', Jersey: '泽西岛', Guernsey: '根西岛',
}

function translate(lang: Language, key: MessageKey): string {
  return messages[lang][key] ?? messages.zh[key] ?? key
}

export function cityName(name: string, lang: Language): string {
  if (!name || lang === 'en') return name
  return CITY_ZH[name] || name
}
export function countryName(name: string, lang: Language): string {
  if (!name || lang === 'en') return name
  return COUNTRY_ZH[name] || name
}

interface LanguageValue { lang: Language; setLang: (lang: Language) => void }
const LanguageContext = createContext<LanguageValue | null>(null)

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Language>(resolveInitial)
  const value = useMemo<LanguageValue>(() => ({
    lang,
    setLang: (next) => {
      localStorage.setItem(STORAGE_KEY, next)
      setLangState(next)
    },
  }), [lang])
  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>
}

export function useLanguage(): LanguageValue {
  const value = useContext(LanguageContext)
  if (!value) throw new Error('useLanguage must be used within LanguageProvider')
  return value
}

export function useT(): (key: MessageKey) => string {
  const { lang } = useLanguage()
  return useMemo(() => (key) => translate(lang, key), [lang])
}
