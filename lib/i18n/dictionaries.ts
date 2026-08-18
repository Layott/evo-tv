import type { Locale } from "./locales";

/**
 * The shell: everything a viewer clicks rather than reads.
 *
 * Navigation, buttons, form labels, states and errors. Long-form page copy is
 * deliberately not here yet, because translating a paragraph badly is worse
 * than leaving it in English while a paragraph is what it is; a mistranslated
 * button, by contrast, makes the product unusable.
 *
 * Keys are dotted and describe the place, not the English words, so changing
 * the English copy does not orphan six translations.
 *
 * **The three Nigerian languages need a native speaker's pass.** They are
 * written here rather than left blank so the feature is real and reviewable,
 * but Yoruba tone marks in particular carry meaning, and no automated check
 * will catch a word that is grammatical and wrong. Treat `yo`, `ig` and `ha`
 * as a first draft. English is the fallback for anything missing, so removing
 * a doubtful string is always safe.
 */

export type Dictionary = Record<string, string>;

const en: Dictionary = {
  "nav.home": "Home",
  "nav.schedule": "Schedule",
  "nav.channel": "Channel",
  "nav.shows": "Shows",
  "nav.discover": "Discover",
  "nav.events": "Events",
  "nav.shop": "Shop",
  "nav.search": "Search streams, teams, players...",
  "nav.signIn": "Sign in",
  "nav.signOut": "Sign out",
  "nav.profile": "Your profile",
  "nav.settings": "Settings",
  "nav.admin": "Admin",

  "player.live": "LIVE",
  "player.offAir": "Off air",
  "player.watching": "watching",
  "player.tapForSound": "Tap for sound",
  "player.signInToWatch": "Sign in to watch",
  "player.backAt": "Back at",

  "action.watch": "Watch",
  "action.watchLive": "Watch live",
  "action.follow": "Follow",
  "action.following": "Following",
  "action.share": "Share",
  "action.report": "Report",
  "action.save": "Save",
  "action.cancel": "Cancel",
  "action.confirm": "Confirm",
  "action.close": "Close",
  "action.retry": "Try again",
  "action.upgrade": "Upgrade",
  "action.seeAll": "See all",

  "auth.email": "Email",
  "auth.password": "Password",
  "auth.signIn": "Sign in",
  "auth.signUp": "Create an account",
  "auth.forgot": "Forgot your password?",
  "auth.noAccount": "No account yet?",
  "auth.haveAccount": "Already have an account?",

  "settings.title": "Settings",
  "settings.account": "Account",
  "settings.notifications": "Notifications",
  "settings.playback": "Playback",
  "settings.privacy": "Privacy",
  "settings.language": "Language",
  "settings.appearance": "Appearance",
  "settings.billing": "Billing",
  "settings.saved": "Saved",

  "state.loading": "Loading",
  "state.empty": "Nothing here yet",
  "state.error": "Something went wrong",
  "state.offline": "You are offline",

  "chat.title": "Stream Chat",
  "chat.placeholder": "Send a message",
  "chat.send": "Send",
  "chat.signInToChat": "Sign in to chat",
};

const yo: Dictionary = {
  "nav.home": "Ilé",
  "nav.schedule": "Ìtòsẹ́",
  "nav.channel": "Ikànnì",
  "nav.shows": "Àwọn eré",
  "nav.discover": "Ṣàwárí",
  "nav.events": "Àwọn ìṣẹ̀lẹ̀",
  "nav.shop": "Ilé ìtajà",
  "nav.search": "Wá àwọn ìtàn, ẹgbẹ́, oṣeré...",
  "nav.signIn": "Wọlé",
  "nav.signOut": "Jáde",
  "nav.profile": "Profáìlì rẹ",
  "nav.settings": "Ètò",
  "nav.admin": "Alábòójútó",

  "player.live": "LÁÍVÌ",
  "player.offAir": "Kò sí lórí afẹ́fẹ́",
  "player.watching": "ń wò",
  "player.tapForSound": "Tẹ fún ohùn",
  "player.signInToWatch": "Wọlé láti wò",
  "player.backAt": "Yóò padà ní",

  "action.watch": "Wò",
  "action.watchLive": "Wo láìvì",
  "action.follow": "Tẹ̀lé",
  "action.following": "Ń tẹ̀lé",
  "action.share": "Pín",
  "action.report": "Ròyìn",
  "action.save": "Fi pamọ́",
  "action.cancel": "Fagilé",
  "action.confirm": "Jẹ́rìí sí",
  "action.close": "Tì",
  "action.retry": "Gbìyànjú lẹ́ẹ̀kansi",
  "action.upgrade": "Gbé sókè",
  "action.seeAll": "Wo gbogbo rẹ̀",

  "auth.email": "Ímeèlì",
  "auth.password": "Ọ̀rọ̀ ìpamọ́",
  "auth.signIn": "Wọlé",
  "auth.signUp": "Ṣẹ̀dá àkàǹtì",
  "auth.forgot": "Ṣé o gbàgbé ọ̀rọ̀ ìpamọ́ rẹ?",
  "auth.noAccount": "O kò tíì ní àkàǹtì?",
  "auth.haveAccount": "Ó ti ní àkàǹtì?",

  "settings.title": "Ètò",
  "settings.account": "Àkàǹtì",
  "settings.notifications": "Ìfitónilétí",
  "settings.playback": "Ìṣeré",
  "settings.privacy": "Àṣírí",
  "settings.language": "Èdè",
  "settings.appearance": "Ìrísí",
  "settings.billing": "Ìsanwó",
  "settings.saved": "Ti fi pamọ́",

  "state.loading": "Ń gbé wọlé",
  "state.empty": "Kò sí nǹkan níbí",
  "state.error": "Nǹkan kan ṣàṣìṣe",
  "state.offline": "O kò sí lórí ìtàkùn",

  "chat.title": "Ìjíròrò",
  "chat.placeholder": "Fi ìfiránṣẹ́ ránṣẹ́",
  "chat.send": "Fi ránṣẹ́",
  "chat.signInToChat": "Wọlé láti bá sọ̀rọ̀",
};

const ig: Dictionary = {
  "nav.home": "Ụlọ",
  "nav.schedule": "Usoro ihe omume",
  "nav.channel": "Ọwa",
  "nav.shows": "Ihe ngosi",
  "nav.discover": "Chọpụta",
  "nav.events": "Emume",
  "nav.shop": "Ụlọ ahịa",
  "nav.search": "Chọọ ihe ngosi, otu, ndị egwuregwu...",
  "nav.signIn": "Banye",
  "nav.signOut": "Pụọ",
  "nav.profile": "Profaịlụ gị",
  "nav.settings": "Ntọala",
  "nav.admin": "Onye nchịkwa",

  "player.live": "LAIVỤ",
  "player.offAir": "Anaghị agbasa",
  "player.watching": "na-ekiri",
  "player.tapForSound": "Pịa maka ụda",
  "player.signInToWatch": "Banye ka ị kiri",
  "player.backAt": "Ọ ga-alaghachi na",

  "action.watch": "Kiri",
  "action.watchLive": "Kiri laivụ",
  "action.follow": "Soro",
  "action.following": "Na-eso",
  "action.share": "Kesaa",
  "action.report": "Kọọ",
  "action.save": "Chekwaa",
  "action.cancel": "Kagbuo",
  "action.confirm": "Kwado",
  "action.close": "Mechie",
  "action.retry": "Nwaa ọzọ",
  "action.upgrade": "Kwalite",
  "action.seeAll": "Hụ ha niile",

  "auth.email": "Ozi ịntanetị",
  "auth.password": "Okwuntughe",
  "auth.signIn": "Banye",
  "auth.signUp": "Mepụta akaụntụ",
  "auth.forgot": "Ị chefuru okwuntughe gị?",
  "auth.noAccount": "Ị nwebeghị akaụntụ?",
  "auth.haveAccount": "Ị nweelarị akaụntụ?",

  "settings.title": "Ntọala",
  "settings.account": "Akaụntụ",
  "settings.notifications": "Ọkwa",
  "settings.playback": "Ịkpọghachi",
  "settings.privacy": "Nzuzo",
  "settings.language": "Asụsụ",
  "settings.appearance": "Ọdịdị",
  "settings.billing": "Ụgwọ",
  "settings.saved": "Echekwara",

  "state.loading": "Na-adọba",
  "state.empty": "O nweghị ihe ebe a",
  "state.error": "Ihe adịghị mma",
  "state.offline": "Ị nọghị n'ịntanetị",

  "chat.title": "Nkata",
  "chat.placeholder": "Zipu ozi",
  "chat.send": "Zipu",
  "chat.signInToChat": "Banye ka ị kparịta ụka",
};

const ha: Dictionary = {
  "nav.home": "Gida",
  "nav.schedule": "Jadawali",
  "nav.channel": "Tasha",
  "nav.shows": "Shirye-shirye",
  "nav.discover": "Gano",
  "nav.events": "Abubuwan da suka faru",
  "nav.shop": "Kanti",
  "nav.search": "Nemi shirye-shirye, ƙungiyoyi, 'yan wasa...",
  "nav.signIn": "Shiga",
  "nav.signOut": "Fita",
  "nav.profile": "Bayanin ka",
  "nav.settings": "Saituna",
  "nav.admin": "Mai kula",

  "player.live": "KAI TSAYE",
  "player.offAir": "Ba a kan iska",
  "player.watching": "suna kallo",
  "player.tapForSound": "Danna don sauti",
  "player.signInToWatch": "Shiga don kallo",
  "player.backAt": "Zai dawo da",

  "action.watch": "Kalli",
  "action.watchLive": "Kalli kai tsaye",
  "action.follow": "Bi",
  "action.following": "Ana bi",
  "action.share": "Raba",
  "action.report": "Kai rahoto",
  "action.save": "Ajiye",
  "action.cancel": "Soke",
  "action.confirm": "Tabbatar",
  "action.close": "Rufe",
  "action.retry": "Sake gwadawa",
  "action.upgrade": "Haɓaka",
  "action.seeAll": "Duba duka",

  "auth.email": "Imel",
  "auth.password": "Kalmar sirri",
  "auth.signIn": "Shiga",
  "auth.signUp": "Ƙirƙiri asusu",
  "auth.forgot": "Ka manta kalmar sirri?",
  "auth.noAccount": "Ba ka da asusu tukuna?",
  "auth.haveAccount": "Kana da asusu?",

  "settings.title": "Saituna",
  "settings.account": "Asusu",
  "settings.notifications": "Sanarwa",
  "settings.playback": "Sake kunnawa",
  "settings.privacy": "Sirri",
  "settings.language": "Harshe",
  "settings.appearance": "Kamanni",
  "settings.billing": "Biyan kuɗi",
  "settings.saved": "An ajiye",

  "state.loading": "Ana lodawa",
  "state.empty": "Babu komai a nan",
  "state.error": "Wani abu ya ɓaci",
  "state.offline": "Ba ka kan layi ba",

  "chat.title": "Hira",
  "chat.placeholder": "Aika saƙo",
  "chat.send": "Aika",
  "chat.signInToChat": "Shiga don hira",
};

const fr: Dictionary = {
  "nav.home": "Accueil",
  "nav.schedule": "Programme",
  "nav.channel": "Chaîne",
  "nav.shows": "Émissions",
  "nav.discover": "Découvrir",
  "nav.events": "Événements",
  "nav.shop": "Boutique",
  "nav.search": "Rechercher des directs, équipes, joueurs...",
  "nav.signIn": "Se connecter",
  "nav.signOut": "Se déconnecter",
  "nav.profile": "Votre profil",
  "nav.settings": "Paramètres",
  "nav.admin": "Administration",

  "player.live": "EN DIRECT",
  "player.offAir": "Hors antenne",
  "player.watching": "spectateurs",
  "player.tapForSound": "Appuyez pour le son",
  "player.signInToWatch": "Connectez-vous pour regarder",
  "player.backAt": "Retour à",

  "action.watch": "Regarder",
  "action.watchLive": "Regarder en direct",
  "action.follow": "Suivre",
  "action.following": "Abonné",
  "action.share": "Partager",
  "action.report": "Signaler",
  "action.save": "Enregistrer",
  "action.cancel": "Annuler",
  "action.confirm": "Confirmer",
  "action.close": "Fermer",
  "action.retry": "Réessayer",
  "action.upgrade": "Passer à Premium",
  "action.seeAll": "Tout voir",

  "auth.email": "E-mail",
  "auth.password": "Mot de passe",
  "auth.signIn": "Se connecter",
  "auth.signUp": "Créer un compte",
  "auth.forgot": "Mot de passe oublié ?",
  "auth.noAccount": "Pas encore de compte ?",
  "auth.haveAccount": "Vous avez déjà un compte ?",

  "settings.title": "Paramètres",
  "settings.account": "Compte",
  "settings.notifications": "Notifications",
  "settings.playback": "Lecture",
  "settings.privacy": "Confidentialité",
  "settings.language": "Langue",
  "settings.appearance": "Apparence",
  "settings.billing": "Facturation",
  "settings.saved": "Enregistré",

  "state.loading": "Chargement",
  "state.empty": "Rien ici pour le moment",
  "state.error": "Une erreur est survenue",
  "state.offline": "Vous êtes hors ligne",

  "chat.title": "Chat du direct",
  "chat.placeholder": "Envoyer un message",
  "chat.send": "Envoyer",
  "chat.signInToChat": "Connectez-vous pour discuter",
};

const pt: Dictionary = {
  "nav.home": "Início",
  "nav.schedule": "Programação",
  "nav.channel": "Canal",
  "nav.shows": "Programas",
  "nav.discover": "Descobrir",
  "nav.events": "Eventos",
  "nav.shop": "Loja",
  "nav.search": "Pesquisar transmissões, equipas, jogadores...",
  "nav.signIn": "Entrar",
  "nav.signOut": "Sair",
  "nav.profile": "O seu perfil",
  "nav.settings": "Definições",
  "nav.admin": "Administração",

  "player.live": "AO VIVO",
  "player.offAir": "Fora do ar",
  "player.watching": "a assistir",
  "player.tapForSound": "Toque para o som",
  "player.signInToWatch": "Entre para assistir",
  "player.backAt": "Volta às",

  "action.watch": "Assistir",
  "action.watchLive": "Assistir ao vivo",
  "action.follow": "Seguir",
  "action.following": "A seguir",
  "action.share": "Partilhar",
  "action.report": "Denunciar",
  "action.save": "Guardar",
  "action.cancel": "Cancelar",
  "action.confirm": "Confirmar",
  "action.close": "Fechar",
  "action.retry": "Tentar novamente",
  "action.upgrade": "Fazer upgrade",
  "action.seeAll": "Ver tudo",

  "auth.email": "E-mail",
  "auth.password": "Palavra-passe",
  "auth.signIn": "Entrar",
  "auth.signUp": "Criar conta",
  "auth.forgot": "Esqueceu a palavra-passe?",
  "auth.noAccount": "Ainda não tem conta?",
  "auth.haveAccount": "Já tem conta?",

  "settings.title": "Definições",
  "settings.account": "Conta",
  "settings.notifications": "Notificações",
  "settings.playback": "Reprodução",
  "settings.privacy": "Privacidade",
  "settings.language": "Idioma",
  "settings.appearance": "Aparência",
  "settings.billing": "Faturação",
  "settings.saved": "Guardado",

  "state.loading": "A carregar",
  "state.empty": "Ainda não há nada aqui",
  "state.error": "Algo correu mal",
  "state.offline": "Está offline",

  "chat.title": "Chat da transmissão",
  "chat.placeholder": "Enviar mensagem",
  "chat.send": "Enviar",
  "chat.signInToChat": "Entre para conversar",
};

/**
 * Swahili is listed in settings and deliberately not translated yet.
 *
 * Leaving it empty means every key falls back to English, which is honest: the
 * option exists because the platform intends to reach East Africa, and shipping
 * a half-guessed dictionary would be worse than shipping English while somebody
 * who speaks it writes one.
 */
const sw: Dictionary = {};

export const DICTIONARIES: Record<Locale, Dictionary> = {
  en,
  yo,
  ig,
  ha,
  fr,
  pt,
  sw,
};
