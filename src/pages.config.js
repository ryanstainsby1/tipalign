import Dashboard from './pages/Dashboard';
import Locations from './pages/Locations';
import Employees from './pages/Employees';
import Allocations from './pages/Allocations';
import Compliance from './pages/Compliance';
import Settings from './pages/Settings';
import LocationSettings from './pages/LocationSettings';
import EmployeePortal from './pages/EmployeePortal';
import ConnectSquare from './pages/ConnectSquare';
import __Layout from './Layout.jsx';


export const PAGES = {
    "Dashboard": Dashboard,
    "Locations": Locations,
    "Employees": Employees,
    "Allocations": Allocations,
    "Compliance": Compliance,
    "Settings": Settings,
    "LocationSettings": LocationSettings,
    "EmployeePortal": EmployeePortal,
    "ConnectSquare": ConnectSquare,
}

export const pagesConfig = {
    mainPage: "Dashboard",
    Pages: PAGES,
    Layout: __Layout,
};