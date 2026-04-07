/**
 * Known extension IDs that LinkedIn probes for.
 * Source: BrowserGate investigation + Chrome Web Store lookups.
 * Categories help users understand WHY LinkedIn cares about each extension.
 */

const KNOWN_EXTENSIONS = {
  // Job Search & Recruiting (LinkedIn cares most about these)
  'hohnhphdgdjfjhffjmcailfcopbjinoa': { name: 'Apollo.io', category: 'Sales/Recruiting' },
  'mloajfnmjckfjbeeofcdaecbdiomhmge': { name: 'Lusha', category: 'Sales/Recruiting' },
  'igbodamhfgefdnkfnlibkaalajmdhnhe': { name: 'ZoomInfo', category: 'Sales/Recruiting' },
  'djhbpbdahobikfpgnljekbeddkfjihoe': { name: 'Dux-Soup', category: 'LinkedIn Automation' },
  'annlhfjgbkfmbbejkbddonlnelojenje': { name: 'Linked Helper', category: 'LinkedIn Automation' },
  'pdlmjhgkfejifkoblfmeachcifmjgpmb': { name: 'PhantomBuster', category: 'LinkedIn Automation' },
  'ggalmhbpmobfhmjajnhfbfancmiahekb': { name: 'Octopus CRM', category: 'LinkedIn Automation' },
  'lnohnflgaaadeikjjkfjnmpcccefmhbf': { name: 'Expandi', category: 'LinkedIn Automation' },
  'jjkchpdmjjdmalgembblgafllbpcjlei': { name: 'Hunter.io', category: 'Email Finder' },
  'eagoljnfemhidemolgapnimkklahdmkn': { name: 'Snov.io', category: 'Email Finder' },
  'liecbddmkiiihnedobmlmillhodjkdmb': { name: 'LinkedIn Sales Navigator Scraper', category: 'Data Scraping' },

  // Ad Blockers & Privacy (LinkedIn detects if you're blocking their ads)
  'cjpalhdlnbpafiamejdnhcphjbkeiagm': { name: 'uBlock Origin', category: 'Ad Blocker' },
  'cfhdojbkjhnklbpkdaibdccddilifddb': { name: 'Adblock Plus', category: 'Ad Blocker' },
  'gighmmpiobklfepjocnamgkkbiglidom': { name: 'AdBlock', category: 'Ad Blocker' },
  'gcbommkclmhbdagooglkinlfhpkaicnk': { name: 'HTTPS Everywhere', category: 'Privacy' },
  'pkehgijcmpdhfbdbbnkijodmdjhbjlgp': { name: 'Privacy Badger', category: 'Privacy' },
  'bgnkhhnnamicmpeenaelnjfhikgbkllg': { name: 'AdGuard', category: 'Ad Blocker' },
  'eimadpbcbfnmbkopoojfekhnkhdbieeh': { name: 'Dark Reader', category: 'Accessibility' },
  'dbepggeogbaibhgnhhndojpepiihcmeb': { name: 'Vimium', category: 'Productivity' },

  // Password Managers (reveals security posture)
  'nngceckbapebfimnlniiiahkandclblb': { name: 'Bitwarden', category: 'Password Manager' },
  'hdokiejnpimakedhajhdlcegeplioahd': { name: 'LastPass', category: 'Password Manager' },
  'aeblfdkhhhdcdjpifhhbdiojplfjncoa': { name: '1Password', category: 'Password Manager' },
  'fdjamakpfbbddfjaooikfcpapjhoafpg': { name: 'Dashlane', category: 'Password Manager' },

  // Developer Tools (reveals technical role)
  'fmkadmapgofadopljbjfkapdkoienihi': { name: 'React Developer Tools', category: 'Developer' },
  'nhdogjmejiglipccpnnnanhbledajbpd': { name: 'Vue.js devtools', category: 'Developer' },
  'lmhkpmbekcpmknklioeibfkpmmfibljd': { name: 'Redux DevTools', category: 'Developer' },
  'bfbameneiokkgbdmiekhjnmfkcnldhhm': { name: 'Web Developer', category: 'Developer' },
  'aiifbnbfobpmeekipheeijimdpnlpgpp': { name: 'JSON Viewer', category: 'Developer' },
  'aapbdbdomjkkjkaonfhkkikfgjllcleb': { name: 'Google Translate', category: 'Productivity' },

  // Accessibility (sensitive — reveals disabilities/needs)
  'kgejglhpjiefppelpmljglcjbhoiplfn': { name: 'Grammarly', category: 'Writing/Accessibility' },
  'ghbmnnjooekpmoecnnnilnnbfdlolhkhi': { name: 'Google Docs Offline', category: 'Productivity' },
  'gpaiobkfhnonedkhhfjpmhdalgeoebfa': { name: 'Tab Modifier', category: 'Productivity' },

  // VPN/Security (reveals security awareness)
  'bihmplhobchoageeokmgbdihknkjbknd': { name: 'NordVPN', category: 'VPN/Security' },
  'majdfhpaihoncoakbjgbdhglocklcgno': { name: 'ExpressVPN', category: 'VPN/Security' },
};

// Category descriptions for UI display
const CATEGORY_RISKS = {
  'Sales/Recruiting': 'LinkedIn detects competitors scraping their data',
  'LinkedIn Automation': 'LinkedIn actively bans users of these tools',
  'Email Finder': 'Used to extract contact info from LinkedIn profiles',
  'Data Scraping': 'Violates LinkedIn ToS — detection leads to account restrictions',
  'Ad Blocker': 'Reveals you block LinkedIn ads — affects ad targeting',
  'Privacy': 'Shows you actively protect your privacy',
  'Password Manager': 'Reveals your security posture and tool preferences',
  'Developer': 'Reveals your technical role and stack',
  'Accessibility': 'Sensitive — may reveal disabilities or learning needs',
  'Writing/Accessibility': 'May indicate non-native speaker or learning differences',
  'Productivity': 'General productivity tools',
  'VPN/Security': 'Shows you use encryption/privacy tools',
};
