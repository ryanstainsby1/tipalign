import Allocations from './pages/Allocations';
import Compliance from './pages/Compliance';
import ConnectSquare from './pages/ConnectSquare';
import Dashboard from './pages/Dashboard';
import EmployeePortal from './pages/EmployeePortal';
import Employees from './pages/Employees';
import LocationSettings from './pages/LocationSettings';
import Locations from './pages/Locations';
import Reconciliation from './pages/Reconciliation';
import RulesBuilder from './pages/RulesBuilder';
import Settings from './pages/Settings';
import Ledger from './pages/Ledger';
import AllocationDetail from './pages/AllocationDetail';
import Disputes from './pages/Disputes';
import __Layout from './Layout.jsx';


export const PAGES = {
    "Allocations": Allocations,
    "Compliance": Compliance,
    "ConnectSquare": ConnectSquare,
    "Dashboard": Dashboard,
    "EmployeePortal": EmployeePortal,
    "Employees": Employees,
    "LocationSettings": LocationSettings,
    "Locations": Locations,
    "Reconciliation": Reconciliation,
    "RulesBuilder": RulesBuilder,
    "Settings": Settings,
    "Ledger": Ledger,
    "AllocationDetail": AllocationDetail,
    "Disputes": Disputes,
}

export const pagesConfig = {
    mainPage: "Dashboard",
    Pages: PAGES,
    Layout: __Layout,
};