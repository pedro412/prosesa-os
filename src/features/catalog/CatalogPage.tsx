import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

import { CategoriesList } from './categories/CategoriesList'
import { ItemsList } from './items/ItemsList'
import { catalogMessages } from './messages'

export function CatalogPage() {
  return (
    <div className="space-y-6" data-testid="catalog-page">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">{catalogMessages.page.title}</h1>
        <p className="text-muted-foreground text-sm">{catalogMessages.page.description}</p>
      </header>

      <Tabs defaultValue="items" className="space-y-6">
        <TabsList>
          <TabsTrigger value="items" data-testid="catalog-tab-items">
            {catalogMessages.tabs.items}
          </TabsTrigger>
          <TabsTrigger value="categories" data-testid="catalog-tab-categories">
            {catalogMessages.tabs.categories}
          </TabsTrigger>
        </TabsList>
        <TabsContent value="items">
          <ItemsList />
        </TabsContent>
        <TabsContent value="categories">
          <CategoriesList />
        </TabsContent>
      </Tabs>
    </div>
  )
}
