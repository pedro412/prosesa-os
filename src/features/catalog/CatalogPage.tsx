import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { isAdmin, useCurrentProfile } from '@/lib/queries/profiles'

import { CategoriesList } from './categories/CategoriesList'
import { ItemsList } from './items/ItemsList'
import { catalogMessages } from './messages'

export function CatalogPage() {
  const profile = useCurrentProfile()
  const canEdit = isAdmin(profile.data)

  return (
    <div className="space-y-6" data-testid="catalog-page">
      <header className="space-y-2">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold tracking-tight">{catalogMessages.page.title}</h1>
          {!canEdit && (
            <Badge variant="secondary" data-testid="catalog-read-only-badge">
              {catalogMessages.readOnly.badge}
            </Badge>
          )}
        </div>
        <p className="text-muted-foreground text-sm">
          {canEdit ? catalogMessages.page.description : catalogMessages.readOnly.description}
        </p>
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
          <ItemsList canEdit={canEdit} />
        </TabsContent>
        <TabsContent value="categories">
          <CategoriesList canEdit={canEdit} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
