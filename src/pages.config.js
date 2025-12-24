import AllocationDetail from './pages/AllocationDetail';
import Allocations from './pages/Allocations';
import ButtonWiringChecklist from './pages/ButtonWiringChecklist';
import Compliance from './pages/Compliance';
import ComplianceNotes from './pages/ComplianceNotes';
import ConnectSquare from './pages/ConnectSquare';
import Dashboard from './pages/Dashboard';
import Disputes from './pages/Disputes';
import EmployeePortal from './pages/EmployeePortal';
import Employees from './pages/Employees';
import Exports from './pages/Exports';
import Ledger from './pages/Ledger';
import LocationSettings from './pages/LocationSettings';
import Locations from './pages/Locations';
import Reconciliation from './pages/Reconciliation';
import RulesBuilder from './pages/RulesBuilder';
import Settings from './pages/Settings';
import SmokeTest from './pages/SmokeTest';
import SquareReviewPack from './pages/SquareReviewPack';
import SystemStatus from './pages/SystemStatus';
import __Layout from './Layout.jsx';


export const PAGES = {
    "AllocationDetail": AllocationDetail,
    "Allocations": Allocations,
    "ButtonWiringChecklist": ButtonWiringChecklist,
    "Compliance": Compliance,
    "ComplianceNotes": ComplianceNotes,
    "ConnectSquare": ConnectSquare,
    "Dashboard": Dashboard,
    "Disputes": Disputes,
    "EmployeePortal": EmployeePortal,
    "Employees": Employees,
    "Exports": Exports,
    "Ledger": Ledger,
    "LocationSettings": LocationSettings,
    "Locations": Locations,
    "Reconciliation": Reconciliation,
    "RulesBuilder": RulesBuilder,
    "Settings": Settings,
    "SmokeTest": SmokeTest,
    "SquareReviewPack": SquareReviewPack,
    "SystemStatus": SystemStatus,
}

export const pagesConfig = {
    mainPage: "Dashboard",
    Pages: PAGES,
    Layout: __Layout,
};