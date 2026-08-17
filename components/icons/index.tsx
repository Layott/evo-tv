/**
 * The product's icon set.
 *
 * Phosphor, not Lucide. Two reasons, and the second is the one that matters.
 *
 * The no-vibecoded-look rule names "the default Lucide icon set dropped in
 * unchanged" directly, and 119 files were importing exactly that.
 *
 * The deeper problem is that every Lucide glyph is a 2px open stroke. After
 * the hairline ban took the lines out of cards, chips, dividers and empty
 * states, the icons were the last place in the product still building shapes
 * out of thin strokes - a hundred small outlined rectangles and circles, which
 * is the look the ban exists to remove. Phosphor ships six weights including a
 * real `fill`, so an icon can be a shape.
 *
 * Weight is assigned by what the glyph is, not by taste:
 *
 * - `fill` for anything that depicts an object or a state: bell, heart, play,
 *   shield, calendar, user, television. These read as marks.
 * - `bold` for structural glyphs that are inherently a line: arrows, carets,
 *   the tick, plus and minus, the search lens, the close cross. Filling an
 *   arrow produces a blob.
 *
 * Every export is named after the Lucide icon it replaces, so the 119 call
 * sites changed one import line and nothing else. The names are a migration
 * affordance, not a style: new code should still import from here.
 *
 * Imported from `@phosphor-icons/react/dist/ssr` deliberately. The package's
 * main entry reads `IconContext` through `useContext`, which makes every icon
 * a client component and would have forced `"use client"` onto server pages
 * that render nothing but an icon. The SSR build takes the same props and
 * holds no context.
 *
 * Three Lucide icons are deliberately absent: Sparkles, Star and Crown. The
 * rule bans sparkle and star "AI" icons outright, and each call site needed a
 * decision about what it was actually trying to say rather than a mechanical
 * swap.
 *
 * Generated once and then edited by hand. To add an icon, add the export.
 */
import * as React from "react";
import type { Icon as PhosphorIcon, IconProps, IconWeight } from "@phosphor-icons/react";

import { ArrowClockwise as PArrowClockwise } from "@phosphor-icons/react/dist/ssr/ArrowClockwise";
import { ArrowCounterClockwise as PArrowCounterClockwise } from "@phosphor-icons/react/dist/ssr/ArrowCounterClockwise";
import { ArrowDown as PArrowDown } from "@phosphor-icons/react/dist/ssr/ArrowDown";
import { ArrowDownRight as PArrowDownRight } from "@phosphor-icons/react/dist/ssr/ArrowDownRight";
import { ArrowLeft as PArrowLeft } from "@phosphor-icons/react/dist/ssr/ArrowLeft";
import { ArrowRight as PArrowRight } from "@phosphor-icons/react/dist/ssr/ArrowRight";
import { ArrowSquareOut as PArrowSquareOut } from "@phosphor-icons/react/dist/ssr/ArrowSquareOut";
import { ArrowUUpLeft as PArrowUUpLeft } from "@phosphor-icons/react/dist/ssr/ArrowUUpLeft";
import { ArrowUp as PArrowUp } from "@phosphor-icons/react/dist/ssr/ArrowUp";
import { ArrowUpRight as PArrowUpRight } from "@phosphor-icons/react/dist/ssr/ArrowUpRight";
import { ArrowsClockwise as PArrowsClockwise } from "@phosphor-icons/react/dist/ssr/ArrowsClockwise";
import { ArrowsDownUp as PArrowsDownUp } from "@phosphor-icons/react/dist/ssr/ArrowsDownUp";
import { Bank as PBank } from "@phosphor-icons/react/dist/ssr/Bank";
import { Bell as PBell } from "@phosphor-icons/react/dist/ssr/Bell";
import { BellRinging as PBellRinging } from "@phosphor-icons/react/dist/ssr/BellRinging";
import { BellSlash as PBellSlash } from "@phosphor-icons/react/dist/ssr/BellSlash";
import { BookmarkSimple as PBookmarkSimple } from "@phosphor-icons/react/dist/ssr/BookmarkSimple";
import { Books as PBooks } from "@phosphor-icons/react/dist/ssr/Books";
import { Broadcast as PBroadcast } from "@phosphor-icons/react/dist/ssr/Broadcast";
import { CalendarBlank as PCalendarBlank } from "@phosphor-icons/react/dist/ssr/CalendarBlank";
import { CalendarDots as PCalendarDots } from "@phosphor-icons/react/dist/ssr/CalendarDots";
import { CalendarPlus as PCalendarPlus } from "@phosphor-icons/react/dist/ssr/CalendarPlus";
import { CaretDown as PCaretDown } from "@phosphor-icons/react/dist/ssr/CaretDown";
import { CaretLeft as PCaretLeft } from "@phosphor-icons/react/dist/ssr/CaretLeft";
import { CaretRight as PCaretRight } from "@phosphor-icons/react/dist/ssr/CaretRight";
import { CaretUp as PCaretUp } from "@phosphor-icons/react/dist/ssr/CaretUp";
import { ChartBar as PChartBar } from "@phosphor-icons/react/dist/ssr/ChartBar";
import { ChartBarHorizontal as PChartBarHorizontal } from "@phosphor-icons/react/dist/ssr/ChartBarHorizontal";
import { Chat as PChat } from "@phosphor-icons/react/dist/ssr/Chat";
import { ChatCircle as PChatCircle } from "@phosphor-icons/react/dist/ssr/ChatCircle";
import { Check as PCheck } from "@phosphor-icons/react/dist/ssr/Check";
import { CheckCircle as PCheckCircle } from "@phosphor-icons/react/dist/ssr/CheckCircle";
import { Checks as PChecks } from "@phosphor-icons/react/dist/ssr/Checks";
import { Circle as PCircle } from "@phosphor-icons/react/dist/ssr/Circle";
import { CircleNotch as PCircleNotch } from "@phosphor-icons/react/dist/ssr/CircleNotch";
import { Clock as PClock } from "@phosphor-icons/react/dist/ssr/Clock";
import { ClosedCaptioning as PClosedCaptioning } from "@phosphor-icons/react/dist/ssr/ClosedCaptioning";
import { Code as PCode } from "@phosphor-icons/react/dist/ssr/Code";
import { Coins as PCoins } from "@phosphor-icons/react/dist/ssr/Coins";
import { Compass as PCompass } from "@phosphor-icons/react/dist/ssr/Compass";
import { Copy as PCopy } from "@phosphor-icons/react/dist/ssr/Copy";
import { CornersIn as PCornersIn } from "@phosphor-icons/react/dist/ssr/CornersIn";
import { CornersOut as PCornersOut } from "@phosphor-icons/react/dist/ssr/CornersOut";
import { CreditCard as PCreditCard } from "@phosphor-icons/react/dist/ssr/CreditCard";
import { CurrencyCircleDollar as PCurrencyCircleDollar } from "@phosphor-icons/react/dist/ssr/CurrencyCircleDollar";
import { DotsSixVertical as PDotsSixVertical } from "@phosphor-icons/react/dist/ssr/DotsSixVertical";
import { DotsThree as PDotsThree } from "@phosphor-icons/react/dist/ssr/DotsThree";
import { DownloadSimple as PDownloadSimple } from "@phosphor-icons/react/dist/ssr/DownloadSimple";
import { Envelope as PEnvelope } from "@phosphor-icons/react/dist/ssr/Envelope";
import { Eye as PEye } from "@phosphor-icons/react/dist/ssr/Eye";
import { EyeSlash as PEyeSlash } from "@phosphor-icons/react/dist/ssr/EyeSlash";
import { FileText as PFileText } from "@phosphor-icons/react/dist/ssr/FileText";
import { FilmSlate as PFilmSlate } from "@phosphor-icons/react/dist/ssr/FilmSlate";
import { Fingerprint as PFingerprint } from "@phosphor-icons/react/dist/ssr/Fingerprint";
import { Fire as PFire } from "@phosphor-icons/react/dist/ssr/Fire";
import { Flag as PFlag } from "@phosphor-icons/react/dist/ssr/Flag";
import { FloppyDisk as PFloppyDisk } from "@phosphor-icons/react/dist/ssr/FloppyDisk";
import { Gauge as PGauge } from "@phosphor-icons/react/dist/ssr/Gauge";
import { Gear as PGear } from "@phosphor-icons/react/dist/ssr/Gear";
import { Globe as PGlobe } from "@phosphor-icons/react/dist/ssr/Globe";
import { Headphones as PHeadphones } from "@phosphor-icons/react/dist/ssr/Headphones";
import { Heart as PHeart } from "@phosphor-icons/react/dist/ssr/Heart";
import { HeartBreak as PHeartBreak } from "@phosphor-icons/react/dist/ssr/HeartBreak";
import { House as PHouse } from "@phosphor-icons/react/dist/ssr/House";
import { Image as PImage } from "@phosphor-icons/react/dist/ssr/Image";
import { Info as PInfo } from "@phosphor-icons/react/dist/ssr/Info";
import { Key as PKey } from "@phosphor-icons/react/dist/ssr/Key";
import { Lightning as PLightning } from "@phosphor-icons/react/dist/ssr/Lightning";
import { List as PList } from "@phosphor-icons/react/dist/ssr/List";
import { Lock as PLock } from "@phosphor-icons/react/dist/ssr/Lock";
import { LockKeyOpen as PLockKeyOpen } from "@phosphor-icons/react/dist/ssr/LockKeyOpen";
import { MagnifyingGlass as PMagnifyingGlass } from "@phosphor-icons/react/dist/ssr/MagnifyingGlass";
import { MapPin as PMapPin } from "@phosphor-icons/react/dist/ssr/MapPin";
import { Megaphone as PMegaphone } from "@phosphor-icons/react/dist/ssr/Megaphone";
import { MicrophoneStage as PMicrophoneStage } from "@phosphor-icons/react/dist/ssr/MicrophoneStage";
import { Minus as PMinus } from "@phosphor-icons/react/dist/ssr/Minus";
import { Monitor as PMonitor } from "@phosphor-icons/react/dist/ssr/Monitor";
import { Moon as PMoon } from "@phosphor-icons/react/dist/ssr/Moon";
import { Package as PPackage } from "@phosphor-icons/react/dist/ssr/Package";
import { Palette as PPalette } from "@phosphor-icons/react/dist/ssr/Palette";
import { PaperPlaneTilt as PPaperPlaneTilt } from "@phosphor-icons/react/dist/ssr/PaperPlaneTilt";
import { Pause as PPause } from "@phosphor-icons/react/dist/ssr/Pause";
import { PencilSimple as PPencilSimple } from "@phosphor-icons/react/dist/ssr/PencilSimple";
import { Percent as PPercent } from "@phosphor-icons/react/dist/ssr/Percent";
import { PictureInPicture as PPictureInPicture } from "@phosphor-icons/react/dist/ssr/PictureInPicture";
import { Play as PPlay } from "@phosphor-icons/react/dist/ssr/Play";
import { PlayCircle as PPlayCircle } from "@phosphor-icons/react/dist/ssr/PlayCircle";
import { Plus as PPlus } from "@phosphor-icons/react/dist/ssr/Plus";
import { Printer as PPrinter } from "@phosphor-icons/react/dist/ssr/Printer";
import { Prohibit as PProhibit } from "@phosphor-icons/react/dist/ssr/Prohibit";
import { Pulse as PPulse } from "@phosphor-icons/react/dist/ssr/Pulse";
import { PushPin as PPushPin } from "@phosphor-icons/react/dist/ssr/PushPin";
import { Scissors as PScissors } from "@phosphor-icons/react/dist/ssr/Scissors";
import { SealCheck as PSealCheck } from "@phosphor-icons/react/dist/ssr/SealCheck";
import { ShareNetwork as PShareNetwork } from "@phosphor-icons/react/dist/ssr/ShareNetwork";
import { Shield as PShield } from "@phosphor-icons/react/dist/ssr/Shield";
import { ShieldCheck as PShieldCheck } from "@phosphor-icons/react/dist/ssr/ShieldCheck";
import { ShieldSlash as PShieldSlash } from "@phosphor-icons/react/dist/ssr/ShieldSlash";
import { ShieldWarning as PShieldWarning } from "@phosphor-icons/react/dist/ssr/ShieldWarning";
import { ShoppingBag as PShoppingBag } from "@phosphor-icons/react/dist/ssr/ShoppingBag";
import { ShoppingCart as PShoppingCart } from "@phosphor-icons/react/dist/ssr/ShoppingCart";
import { Sidebar as PSidebar } from "@phosphor-icons/react/dist/ssr/Sidebar";
import { SignOut as PSignOut } from "@phosphor-icons/react/dist/ssr/SignOut";
import { SkipForward as PSkipForward } from "@phosphor-icons/react/dist/ssr/SkipForward";
import { SlidersHorizontal as PSlidersHorizontal } from "@phosphor-icons/react/dist/ssr/SlidersHorizontal";
import { Smiley as PSmiley } from "@phosphor-icons/react/dist/ssr/Smiley";
import { SpeakerHigh as PSpeakerHigh } from "@phosphor-icons/react/dist/ssr/SpeakerHigh";
import { SpeakerX as PSpeakerX } from "@phosphor-icons/react/dist/ssr/SpeakerX";
import { SquaresFour as PSquaresFour } from "@phosphor-icons/react/dist/ssr/SquaresFour";
import { StackSimple as PStackSimple } from "@phosphor-icons/react/dist/ssr/StackSimple";
import { Storefront as PStorefront } from "@phosphor-icons/react/dist/ssr/Storefront";
import { Sun as PSun } from "@phosphor-icons/react/dist/ssr/Sun";
import { Tag as PTag } from "@phosphor-icons/react/dist/ssr/Tag";
import { Television as PTelevision } from "@phosphor-icons/react/dist/ssr/Television";
import { ThumbsDown as PThumbsDown } from "@phosphor-icons/react/dist/ssr/ThumbsDown";
import { ThumbsUp as PThumbsUp } from "@phosphor-icons/react/dist/ssr/ThumbsUp";
import { ToggleLeft as PToggleLeft } from "@phosphor-icons/react/dist/ssr/ToggleLeft";
import { Translate as PTranslate } from "@phosphor-icons/react/dist/ssr/Translate";
import { Trash as PTrash } from "@phosphor-icons/react/dist/ssr/Trash";
import { TreeStructure as PTreeStructure } from "@phosphor-icons/react/dist/ssr/TreeStructure";
import { Trophy as PTrophy } from "@phosphor-icons/react/dist/ssr/Trophy";
import { Truck as PTruck } from "@phosphor-icons/react/dist/ssr/Truck";
import { UploadSimple as PUploadSimple } from "@phosphor-icons/react/dist/ssr/UploadSimple";
import { User as PUser } from "@phosphor-icons/react/dist/ssr/User";
import { UserGear as PUserGear } from "@phosphor-icons/react/dist/ssr/UserGear";
import { UserPlus as PUserPlus } from "@phosphor-icons/react/dist/ssr/UserPlus";
import { Users as PUsers } from "@phosphor-icons/react/dist/ssr/Users";
import { Wallet as PWallet } from "@phosphor-icons/react/dist/ssr/Wallet";
import { Warning as PWarning } from "@phosphor-icons/react/dist/ssr/Warning";
import { WarningCircle as PWarningCircle } from "@phosphor-icons/react/dist/ssr/WarningCircle";
import { X as PX } from "@phosphor-icons/react/dist/ssr/X";
import { XCircle as PXCircle } from "@phosphor-icons/react/dist/ssr/XCircle";

export type { IconProps };

/** The shape a component must have to be used as an icon in a config object. */
export type Icon = PhosphorIcon;

function make(Base: PhosphorIcon, weight: IconWeight, name: string): PhosphorIcon {
  // `weight` sits before the spread so a call site can still override it, which
  // a handful do: a follow button wants the outline heart until it is pressed.
  const Wrapped = React.forwardRef<SVGSVGElement, IconProps>((props, ref) => (
    <Base ref={ref} weight={weight} {...props} />
  ));
  Wrapped.displayName = name;
  return Wrapped as PhosphorIcon;
}

export const Activity = make(PPulse, "bold", "Activity");
export const AlertCircle = make(PWarningCircle, "fill", "AlertCircle");
export const AlertTriangle = make(PWarning, "fill", "AlertTriangle");
export const ArrowDown = make(PArrowDown, "bold", "ArrowDown");
export const ArrowDownRight = make(PArrowDownRight, "bold", "ArrowDownRight");
export const ArrowLeft = make(PArrowLeft, "bold", "ArrowLeft");
export const ArrowRight = make(PArrowRight, "bold", "ArrowRight");
export const ArrowUp = make(PArrowUp, "bold", "ArrowUp");
export const ArrowUpDown = make(PArrowsDownUp, "bold", "ArrowUpDown");
export const ArrowUpRight = make(PArrowUpRight, "bold", "ArrowUpRight");
export const BadgeCheck = make(PSealCheck, "fill", "BadgeCheck");
export const Ban = make(PProhibit, "bold", "Ban");
export const BarChart3 = make(PChartBar, "fill", "BarChart3");
export const Bell = make(PBell, "fill", "Bell");
export const BellOff = make(PBellSlash, "fill", "BellOff");
export const BellRing = make(PBellRinging, "fill", "BellRing");
export const Bookmark = make(PBookmarkSimple, "fill", "Bookmark");
export const BookmarkPlus = make(PBookmarkSimple, "fill", "BookmarkPlus");
export const Calendar = make(PCalendarBlank, "fill", "Calendar");
export const CalendarDays = make(PCalendarDots, "fill", "CalendarDays");
export const CalendarPlus = make(PCalendarPlus, "fill", "CalendarPlus");
export const CalendarRange = make(PCalendarBlank, "fill", "CalendarRange");
export const Captions = make(PClosedCaptioning, "fill", "Captions");
export const Check = make(PCheck, "bold", "Check");
export const CheckCheck = make(PChecks, "bold", "CheckCheck");
export const CheckCircle2 = make(PCheckCircle, "fill", "CheckCircle2");
export const CheckIcon = make(PCheck, "bold", "CheckIcon");
export const ChevronDown = make(PCaretDown, "bold", "ChevronDown");
export const ChevronDownIcon = make(PCaretDown, "bold", "ChevronDownIcon");
export const ChevronLeft = make(PCaretLeft, "bold", "ChevronLeft");
export const ChevronLeftIcon = make(PCaretLeft, "bold", "ChevronLeftIcon");
export const ChevronRight = make(PCaretRight, "bold", "ChevronRight");
export const ChevronRightIcon = make(PCaretRight, "bold", "ChevronRightIcon");
export const ChevronUp = make(PCaretUp, "bold", "ChevronUp");
export const ChevronUpIcon = make(PCaretUp, "bold", "ChevronUpIcon");
export const Circle = make(PCircle, "fill", "Circle");
export const CircleDollarSign = make(PCurrencyCircleDollar, "fill", "CircleDollarSign");
export const CircleIcon = make(PCircle, "fill", "CircleIcon");
export const Clock = make(PClock, "fill", "Clock");
export const Code2 = make(PCode, "bold", "Code2");
export const Coins = make(PCoins, "fill", "Coins");
export const Compass = make(PCompass, "fill", "Compass");
export const Copy = make(PCopy, "bold", "Copy");
export const CreditCard = make(PCreditCard, "fill", "CreditCard");
export const Download = make(PDownloadSimple, "bold", "Download");
export const Edit = make(PPencilSimple, "fill", "Edit");
export const ExternalLink = make(PArrowSquareOut, "bold", "ExternalLink");
export const Eye = make(PEye, "fill", "Eye");
export const EyeOff = make(PEyeSlash, "fill", "EyeOff");
export const FileText = make(PFileText, "fill", "FileText");
export const Film = make(PFilmSlate, "fill", "Film");
export const Fingerprint = make(PFingerprint, "bold", "Fingerprint");
export const Flag = make(PFlag, "fill", "Flag");
export const Flame = make(PFire, "fill", "Flame");
export const Gauge = make(PGauge, "fill", "Gauge");
export const Globe = make(PGlobe, "fill", "Globe");
export const GripVerticalIcon = make(PDotsSixVertical, "bold", "GripVerticalIcon");
export const Headphones = make(PHeadphones, "fill", "Headphones");
export const Heart = make(PHeart, "fill", "Heart");
export const HeartOff = make(PHeartBreak, "fill", "HeartOff");
export const Home = make(PHouse, "fill", "Home");
export const ImageIcon = make(PImage, "fill", "ImageIcon");
export const Info = make(PInfo, "fill", "Info");
export const Key = make(PKey, "fill", "Key");
export const KeyRound = make(PKey, "fill", "KeyRound");
export const Landmark = make(PBank, "fill", "Landmark");
export const Languages = make(PTranslate, "bold", "Languages");
export const Layers = make(PStackSimple, "fill", "Layers");
export const LayoutDashboard = make(PSquaresFour, "fill", "LayoutDashboard");
export const Library = make(PBooks, "fill", "Library");
export const List = make(PList, "bold", "List");
export const ListTree = make(PTreeStructure, "bold", "ListTree");
export const Loader2 = make(PCircleNotch, "bold", "Loader2");
export const Loader2Icon = make(PCircleNotch, "bold", "Loader2Icon");
export const Lock = make(PLock, "fill", "Lock");
export const LogOut = make(PSignOut, "bold", "LogOut");
export const Mail = make(PEnvelope, "fill", "Mail");
export const MapPin = make(PMapPin, "fill", "MapPin");
export const Maximize = make(PCornersOut, "bold", "Maximize");
export const Megaphone = make(PMegaphone, "fill", "Megaphone");
export const Menu = make(PList, "bold", "Menu");
export const MessageCircle = make(PChatCircle, "fill", "MessageCircle");
export const MessageSquare = make(PChat, "fill", "MessageSquare");
export const Mic2 = make(PMicrophoneStage, "fill", "Mic2");
export const Minimize = make(PCornersIn, "bold", "Minimize");
export const Minus = make(PMinus, "bold", "Minus");
export const MinusIcon = make(PMinus, "bold", "MinusIcon");
export const Monitor = make(PMonitor, "fill", "Monitor");
export const Moon = make(PMoon, "fill", "Moon");
export const MoreHorizontal = make(PDotsThree, "bold", "MoreHorizontal");
export const MoreHorizontalIcon = make(PDotsThree, "bold", "MoreHorizontalIcon");
export const Package = make(PPackage, "fill", "Package");
export const Palette = make(PPalette, "fill", "Palette");
export const PanelLeftIcon = make(PSidebar, "bold", "PanelLeftIcon");
export const Pause = make(PPause, "fill", "Pause");
export const PercentCircle = make(PPercent, "bold", "PercentCircle");
export const PictureInPicture2 = make(PPictureInPicture, "bold", "PictureInPicture2");
export const Pin = make(PPushPin, "fill", "Pin");
export const Play = make(PPlay, "fill", "Play");
export const PlayCircle = make(PPlayCircle, "fill", "PlayCircle");
export const Plus = make(PPlus, "bold", "Plus");
export const Printer = make(PPrinter, "fill", "Printer");
export const Radio = make(PBroadcast, "bold", "Radio");
export const RefreshCw = make(PArrowsClockwise, "bold", "RefreshCw");
export const RotateCcw = make(PArrowCounterClockwise, "bold", "RotateCcw");
export const RotateCw = make(PArrowClockwise, "bold", "RotateCw");
export const Save = make(PFloppyDisk, "fill", "Save");
export const Scissors = make(PScissors, "fill", "Scissors");
export const Search = make(PMagnifyingGlass, "bold", "Search");
export const SearchIcon = make(PMagnifyingGlass, "bold", "SearchIcon");
export const Send = make(PPaperPlaneTilt, "fill", "Send");
export const Settings = make(PGear, "fill", "Settings");
export const Share2 = make(PShareNetwork, "fill", "Share2");
export const Shield = make(PShield, "fill", "Shield");
export const ShieldAlert = make(PShieldWarning, "fill", "ShieldAlert");
export const ShieldBan = make(PShieldSlash, "fill", "ShieldBan");
export const ShieldCheck = make(PShieldCheck, "fill", "ShieldCheck");
export const ShoppingBag = make(PShoppingBag, "fill", "ShoppingBag");
export const ShoppingCart = make(PShoppingCart, "fill", "ShoppingCart");
export const SkipForward = make(PSkipForward, "fill", "SkipForward");
export const SlidersHorizontal = make(PSlidersHorizontal, "bold", "SlidersHorizontal");
export const Smile = make(PSmiley, "fill", "Smile");
export const Store = make(PStorefront, "fill", "Store");
export const Sun = make(PSun, "fill", "Sun");
export const Tag = make(PTag, "fill", "Tag");
export const ThumbsDown = make(PThumbsDown, "fill", "ThumbsDown");
export const ThumbsUp = make(PThumbsUp, "fill", "ThumbsUp");
export const ToggleLeft = make(PToggleLeft, "fill", "ToggleLeft");
export const Trash2 = make(PTrash, "fill", "Trash2");
export const Trophy = make(PTrophy, "fill", "Trophy");
export const Truck = make(PTruck, "fill", "Truck");
export const Tv = make(PTelevision, "fill", "Tv");
export const Undo2 = make(PArrowUUpLeft, "bold", "Undo2");
export const Unlock = make(PLockKeyOpen, "fill", "Unlock");
export const Upload = make(PUploadSimple, "bold", "Upload");
export const User = make(PUser, "fill", "User");
export const UserCog = make(PUserGear, "fill", "UserCog");
export const UserPlus = make(PUserPlus, "fill", "UserPlus");
export const UserRound = make(PUser, "fill", "UserRound");
export const Users = make(PUsers, "fill", "Users");
export const Volume2 = make(PSpeakerHigh, "fill", "Volume2");
export const VolumeX = make(PSpeakerX, "fill", "VolumeX");
export const Vote = make(PChartBarHorizontal, "fill", "Vote");
export const Wallet = make(PWallet, "fill", "Wallet");
export const X = make(PX, "bold", "X");
export const XCircle = make(PXCircle, "fill", "XCircle");
export const XIcon = make(PX, "bold", "XIcon");
export const Zap = make(PLightning, "fill", "Zap");
