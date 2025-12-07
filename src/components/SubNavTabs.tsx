import { cn } from '@/lib/utils';

interface SubNavTab {
  id: string;
  label: string;
}

interface SubNavTabsProps {
  tabs: SubNavTab[];
  activeTab: string;
  onTabChange: (tabId: string) => void;
}

const SubNavTabs = ({ tabs, activeTab, onTabChange }: SubNavTabsProps) => {
  return (
    <div className="flex gap-1 p-1 bg-muted/30 rounded-lg mx-4 mt-2 mb-3">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onTabChange(tab.id)}
          className={cn(
            'flex-1 py-2 px-3 text-sm font-medium rounded-md transition-all duration-200',
            activeTab === tab.id
              ? 'bg-card text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground hover:bg-card/50'
          )}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
};

export default SubNavTabs;
