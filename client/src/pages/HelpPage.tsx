import { useState } from 'react';
import { Link } from 'wouter';
import { ArrowLeft, Search, Home, Settings, Database, GitBranch, FileText, RefreshCw, BarChart3, LayoutDashboard, MessageCircle, Printer } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Badge } from '@/components/ui/badge';
import { helpSections } from '@/data/helpContent';
import { FieldReferenceTable } from '@/components/help/FieldReferenceTable';
import { MarkdownRenderer } from '@/components/help/MarkdownRenderer';

const iconMap: Record<string, any> = {
  Home,
  Settings,
  Database,
  GitBranch,
  FileText,
  RefreshCw,
  BarChart3,
  LayoutDashboard,
  MessageCircle,
};

export default function HelpPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeSection, setActiveSection] = useState<string | null>(null);

  const filteredSections = helpSections.filter((section) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      section.title.toLowerCase().includes(query) ||
      section.overview.toLowerCase().includes(query) ||
      section.fields?.some(field => 
        field.name.toLowerCase().includes(query) ||
        field.description.toLowerCase().includes(query)
      )
    );
  });

  const scrollToSection = (sectionId: string) => {
    setActiveSection(sectionId);
    const element = document.getElementById(sectionId);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
      {/* Header */}
      <div className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Link href="/dashboard" className="inline-flex items-center text-blue-600 hover:text-blue-800" data-testid="link-back-dashboard">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Dashboard
              </Link>
              <div className="h-6 w-px bg-slate-300 dark:bg-slate-600"></div>
              <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                Help & Documentation
              </h1>
            </div>
            <div className="flex items-center space-x-3">
              <div className="relative w-80">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  type="text"
                  placeholder="Search documentation..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                  data-testid="input-search-help"
                />
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handlePrint}
                data-testid="button-print-help"
                className="flex items-center space-x-2"
              >
                <Printer className="h-4 w-4" />
                <span>Print</span>
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto flex gap-6 p-6">
        {/* Left Sidebar - Table of Contents */}
        <div className="w-64 flex-shrink-0">
          <div className="sticky top-24 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-4">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-3 uppercase tracking-wider">
              Contents
            </h2>
            <ScrollArea className="h-[calc(100vh-12rem)]">
              <nav className="space-y-1">
                {filteredSections.map((section) => {
                  const Icon = iconMap[section.icon];
                  return (
                    <button
                      key={section.id}
                      onClick={() => scrollToSection(section.id)}
                      className={`w-full flex items-center space-x-2 px-3 py-2 rounded-md text-sm transition-colors ${
                        activeSection === section.id
                          ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400'
                          : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
                      }`}
                      data-testid={`toc-${section.id}`}
                    >
                      {Icon && <Icon className="h-4 w-4 flex-shrink-0" />}
                      <span className="truncate text-left">{section.title}</span>
                    </button>
                  );
                })}
              </nav>
            </ScrollArea>
          </div>
        </div>

        {/* Right Content Area */}
        <div className="flex-1">
          <ScrollArea className="h-[calc(100vh-8rem)]">
            <div className="space-y-6 pr-4">
              {filteredSections.length === 0 ? (
                <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-12 text-center">
                  <p className="text-slate-500 dark:text-slate-400">
                    No results found for "{searchQuery}"
                  </p>
                </div>
              ) : (
                filteredSections.map((section) => {
                  const Icon = iconMap[section.icon];
                  return (
                    <div
                      key={section.id}
                      id={section.id}
                      className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden"
                    >
                      {/* Section Header */}
                      <div className="bg-gradient-to-r from-blue-50 to-slate-50 dark:from-slate-800 dark:to-slate-800 border-b border-slate-200 dark:border-slate-700 px-6 py-4">
                        <div className="flex items-center space-x-3">
                          {Icon && (
                            <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                              <Icon className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                            </div>
                          )}
                          <div>
                            <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">
                              {section.title}
                            </h2>
                            <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                              {section.overview}
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* Section Content */}
                      <div className="p-6 space-y-6">
                        {/* Workflow Steps */}
                        {section.workflow && section.workflow.length > 0 && (
                          <div>
                            <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-3">
                              Step-by-Step Workflow
                            </h3>
                            <ol className="space-y-2">
                              {section.workflow.map((step, index) => (
                                <li key={index} className="flex items-start space-x-3">
                                  <Badge className="flex-shrink-0 mt-0.5">{index + 1}</Badge>
                                  <span className="text-slate-700 dark:text-slate-300">{step}</span>
                                </li>
                              ))}
                            </ol>
                          </div>
                        )}

                        {/* Field Reference */}
                        {section.fields && section.fields.length > 0 && (
                          <div>
                            <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-3">
                              Field Reference
                            </h3>
                            <FieldReferenceTable fields={section.fields} />
                          </div>
                        )}

                        {/* Subsections */}
                        {section.subsections && section.subsections.length > 0 && (
                          <div>
                            <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-3">
                              Additional Information
                            </h3>
                            <Accordion type="single" collapsible className="space-y-2">
                              {section.subsections.map((subsection, index) => (
                                <AccordionItem
                                  key={index}
                                  value={`subsection-${index}`}
                                  className="border border-slate-200 dark:border-slate-700 rounded-lg px-4"
                                >
                                  <AccordionTrigger className="text-left font-medium text-slate-900 dark:text-slate-100 hover:no-underline">
                                    {subsection.title}
                                  </AccordionTrigger>
                                  <AccordionContent className="text-slate-700 dark:text-slate-300 pt-2">
                                    <MarkdownRenderer content={subsection.content} />
                                  </AccordionContent>
                                </AccordionItem>
                              ))}
                            </Accordion>
                          </div>
                        )}

                        {/* Troubleshooting */}
                        {section.troubleshooting && section.troubleshooting.length > 0 && (
                          <div>
                            <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-3">
                              Troubleshooting
                            </h3>
                            <div className="bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
                              <ul className="space-y-2">
                                {section.troubleshooting.map((tip, index) => (
                                  <li key={index} className="flex items-start space-x-2">
                                    <span className="text-amber-600 dark:text-amber-400 mt-1">⚠</span>
                                    <span className="text-slate-700 dark:text-slate-300 text-sm">{tip}</span>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </ScrollArea>
        </div>
      </div>
    </div>
  );
}
