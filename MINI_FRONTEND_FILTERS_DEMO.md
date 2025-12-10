# Mini Frontend - New Filters Demo

## Overview

The mini frontend (`cto-frontend`) has been updated to demonstrate the new listing filters requested by the frontend developer and approved by Barbie. This serves as a reference implementation for the main frontend development.

## New Features Added

### 🔍 Filter Panel
- **Location**: Click the "🔍 Filters" button next to the search bar
- **Design**: Collapsible panel with 4 filter categories
- **Responsive**: Grid layout that adapts to screen size

### 📊 New Filter Types

#### 1. LP Burned Filter
- **Input**: Number field (0-100%)
- **Logic**: `minLpBurned` - Show tokens with LP burned >= specified percentage
- **Example**: Set to 50 to show tokens with 50%+ LP burned
- **Display**: Shows percentage in "LP Burned" column

#### 2. Top 10 Holders Filter
- **Input**: Number field (0-100%)
- **Logic**: `maxTop10Holders` - Show tokens with top 10 holders < specified percentage
- **Example**: Set to 15 to show tokens with <15% concentration
- **Display**: Shows percentage in "Top 10" column

#### 3. Security Filters
- **Mint Auth Disabled**: Checkbox to show only tokens with disabled mint authority
- **No Raiding**: Checkbox to show only tokens without raiding detection
- **Display**: Shows status badges in "Security" column

### 🎨 UI Components

#### Filter Button
```tsx
<button
  className="px-3 py-1 rounded bg-blue-600 text-white hover:bg-blue-700 text-sm flex items-center gap-1"
  onClick={() => setShowFilters(!showFilters)}
>
  🔍 Filters
</button>
```

#### Filter Panel
- **Grid Layout**: 4 columns on large screens, responsive
- **Input Fields**: Number inputs for percentages
- **Checkboxes**: Boolean filters for security
- **Actions**: Clear All and Apply Filters buttons

#### Table Columns
- **LP Burned**: Shows percentage or "--" if not available
- **Top 10**: Shows percentage or "--" if not available  
- **Security**: Shows status badges for mint auth and raiding

### 🔧 Technical Implementation

#### State Management
```typescript
const [filters, setFilters] = useState({
  minLpBurned: 0,
  maxTop10Holders: 100,
  mintAuthDisabled: false,
  noRaiding: false,
});
const [showFilters, setShowFilters] = useState(false);
```

#### API Integration
```typescript
// Add filter parameters to API calls
if (filters.minLpBurned > 0) params.set('minLpBurned', String(filters.minLpBurned));
if (filters.maxTop10Holders < 100) params.set('maxTop10Holders', String(filters.maxTop10Holders));
if (filters.mintAuthDisabled) params.set('mintAuthDisabled', 'true');
if (filters.noRaiding) params.set('noRaiding', 'true');
```

#### Auto-refresh
```typescript
// Refetch when filters change
useEffect(() => {
  fetchListings(true);
}, [filters]);
```

### 📱 Responsive Design

#### Desktop (lg+)
- 4-column grid layout
- Full filter panel visible
- All table columns shown

#### Tablet (md)
- 2-column grid layout
- Compact filter panel
- Essential columns prioritized

#### Mobile (sm)
- 1-column grid layout
- Stacked filter inputs
- Horizontal scroll for table

### 🎯 Filter Logic Examples

#### High Security Tokens
```typescript
// LP burned >= 50%, Top 10 < 15%, Mint disabled, No raiding
{
  minLpBurned: 50,
  maxTop10Holders: 15,
  mintAuthDisabled: true,
  noRaiding: true
}
```

#### Moderate Security
```typescript
// LP burned >= 25%, Top 10 < 30%
{
  minLpBurned: 25,
  maxTop10Holders: 30,
  mintAuthDisabled: false,
  noRaiding: false
}
```

#### Clear All Filters
```typescript
// Reset to show all tokens
{
  minLpBurned: 0,
  maxTop10Holders: 100,
  mintAuthDisabled: false,
  noRaiding: false
}
```

### 🚀 How to Test

1. **Start the mini frontend**:
   ```bash
   cd cto-frontend
   npm start
   ```

2. **Open the filters**:
   - Click the "🔍 Filters" button
   - Adjust the filter values
   - Click "Apply Filters"

3. **Test different combinations**:
   - Try different LP burned percentages
   - Test top 10 holders limits
   - Toggle security filters
   - Use "Clear All" to reset

4. **Observe the results**:
   - Check the new table columns
   - Verify filter parameters in network requests
   - Test responsive design on different screen sizes

### 📋 API Endpoints Used

```bash
# Basic listings
GET /api/listing/listings?limit=20

# With filters
GET /api/listing/listings?minLpBurned=50&maxTop10Holders=15&mintAuthDisabled=true&noRaiding=true&limit=20

# With search
GET /api/listing/listings?q=PEPE&minLpBurned=25&limit=20
```

### 🎨 Design Patterns

#### Color Coding
- **Green**: Safe/Good (mint disabled, no raiding)
- **Red**: Risky/Bad (mint enabled, raiding detected)
- **Gray**: Unknown/Not available

#### Status Badges
```tsx
<span className={`px-1 py-0.5 rounded text-xs ${
  it.mintAuthDisabled ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
}`}>
  {it.mintAuthDisabled ? 'Mint Disabled' : 'Mint Enabled'}
</span>
```

#### Responsive Grid
```tsx
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
  {/* Filter inputs */}
</div>
```

### 🔄 Integration Notes

#### For Main Frontend Development
1. **Copy the filter state management pattern**
2. **Use the same API parameter names**
3. **Implement similar responsive grid layout**
4. **Follow the color coding conventions**
5. **Add proper loading states and error handling**

#### Backend Requirements
- All filter fields are optional (nullable)
- Mock data is used for development
- Production requires real Solana RPC integration
- Filter logic follows "safer = better" principle

### 📝 Next Steps

1. **Test the mini frontend** with different filter combinations
2. **Study the implementation** for main frontend development
3. **Customize the UI** to match the main frontend design
4. **Add real data sources** when backend analysis is implemented
5. **Implement proper error handling** for production use

This mini frontend serves as a complete reference implementation for the new filter functionality! 🚀
