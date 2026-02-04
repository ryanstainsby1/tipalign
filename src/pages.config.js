/**
 * pages.config.js - Page routing configuration
 * 
 * This file is AUTO-GENERATED. Do not add imports or modify PAGES manually.
 * Pages are auto-registered when you create files in the ./pages/ folder.
 * 
 * THE ONLY EDITABLE VALUE: mainPage
 * This controls which page is the landing page (shown when users visit the app).
 * 
 * Example file structure:
 * 
 *   import HomePage from './pages/HomePage';
 *   import Dashboard from './pages/Dashboard';
 *   import Settings from './pages/Settings';
 *   
 *   export const PAGES = {
 *       "HomePage": HomePage,
 *       "Dashboard": Dashboard,
 *       "Settings": Settings,
 *   }
 *   
 *   export const pagesConfig = {
 *       mainPage: "HomePage",
 *       Pages: PAGES,
 *   };
 * 
 * Example with Layout (wraps all pages):
 *
 *   import Home from './pages/Home';
 *   import Settings from './pages/Settings';
 *   import __Layout from './Layout.jsx';
 *
 *   export const PAGES = {
 *       "Home": Home,
 *       "Settings": Settings,
 *   }
 *
 *   export const pagesConfig = {
 *       mainPage: "Home",
 *       Pages: PAGES,
 *       Layout: __Layout,
 *   };
 *
 * To change the main page from HomePage to Dashboard, use find_replace:
 *   Old: mainPage: "HomePage",
 *   New: mainPage: "Dashboard",
 *
 * The mainPage value must match a key in the PAGES object exactly.
 */
import AllocationDetail from './pages/AllocationDetail';
import Allocations from './pages/Allocations';
import ButtonWiringChecklist from './pages/ButtonWiringChecklist';
import Compliance from './pages/Compliance';
import ComplianceNotes from './pages/ComplianceNotes';
import ComplianceSettings from './pages/ComplianceSettings';
import ConnectSquare from './pages/ConnectSquare';
import Dashboard from './pages/Dashboard';
import Disputes from './pages/Disputes';
import EmployeePortal from './pages/EmployeePortal';
import EmployeeWalletInvite from './pages/EmployeeWalletInvite';
import Employees from './pages/Employees';
import EmployerSignup from './pages/EmployerSignup';
import Exports from './pages/Exports';
import Ledger from './pages/Ledger';
import LocationSettings from './pages/LocationSettings';
import Locations from './pages/Locations';
import OnboardingConnectSquare from './pages/OnboardingConnectSquare';
import OnboardingEmployee from './pages/OnboardingEmployee';
import OnboardingEmployer from './pages/OnboardingEmployer';
import OnboardingRole from './pages/OnboardingRole';
import PublicTip from './pages/PublicTip';
import Reconciliation from './pages/Reconciliation';
import RulesBuilder from './pages/RulesBuilder';
import Settings from './pages/Settings';
import SmokeTest from './pages/SmokeTest';
import SquareReviewPack from './pages/SquareReviewPack';
import SquareTroubleshoot from './pages/SquareTroubleshoot';
import SystemStatus from './pages/SystemStatus';
import Welcome from './pages/Welcome';
import BonusRules from './pages/BonusRules';
import EmployerDashboard from './pages/EmployerDashboard';
import SquareSettings from './pages/SquareSettings';
import EmployeeManagement from './pages/EmployeeManagement';
import __Layout from './Layout.jsx';


export const PAGES = {
    "AllocationDetail": AllocationDetail,
    "Allocations": Allocations,
    "ButtonWiringChecklist": ButtonWiringChecklist,
    "Compliance": Compliance,
    "ComplianceNotes": ComplianceNotes,
    "ComplianceSettings": ComplianceSettings,
    "ConnectSquare": ConnectSquare,
    "Dashboard": Dashboard,
    "Disputes": Disputes,
    "EmployeePortal": EmployeePortal,
    "EmployeeWalletInvite": EmployeeWalletInvite,
    "Employees": Employees,
    "EmployerSignup": EmployerSignup,
    "Exports": Exports,
    "Ledger": Ledger,
    "LocationSettings": LocationSettings,
    "Locations": Locations,
    "OnboardingConnectSquare": OnboardingConnectSquare,
    "OnboardingEmployee": OnboardingEmployee,
    "OnboardingEmployer": OnboardingEmployer,
    "OnboardingRole": OnboardingRole,
    "PublicTip": PublicTip,
    "Reconciliation": Reconciliation,
    "RulesBuilder": RulesBuilder,
    "Settings": Settings,
    "SmokeTest": SmokeTest,
    "SquareReviewPack": SquareReviewPack,
    "SquareTroubleshoot": SquareTroubleshoot,
    "SystemStatus": SystemStatus,
    "Welcome": Welcome,
    "BonusRules": BonusRules,
    "EmployerDashboard": EmployerDashboard,
    "SquareSettings": SquareSettings,
    "EmployeeManagement": EmployeeManagement,
}

export const pagesConfig = {
    mainPage: "Dashboard",
    Pages: PAGES,
    Layout: __Layout,
};