import Dashboard from './pages/Dashboard';
import Locations from './pages/Locations';
import Employees from './pages/Employees';
import Allocations from './pages/Allocations';
import Compliance from './pages/Compliance';
import Settings from './pages/Settings';


export const PAGES = {
    "Dashboard": Dashboard,
    "Locations": Locations,
    "Employees": Employees,
    "Allocations": Allocations,
    "Compliance": Compliance,
    "Settings": Settings,
}

export const pagesConfig = {
    mainPage: "Dashboard",
    Pages: PAGES,
};