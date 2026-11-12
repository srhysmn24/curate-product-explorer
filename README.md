# Curate — Product Explorer

Curate is a simple product browsing website made for my JavaScript mini project. It shows products from a public API and lets users save products they like to a favourites list.

The website is built with HTML, CSS and vanilla JavaScript, without any frameworks.

## Features

- View products retrieved from the [Fake Store API](https://fakestoreapi.com/products).
- Search products by name.
- Filter by category and sort products by price or name.
- Add products to favourites and remove them anytime.
- Keep saved favourites after refreshing the page using `localStorage`.
- Display loading and error messages if the API takes time to respond or cannot be reached.
- Use the website on desktop and mobile screens.

## How to run

1. Download or clone this repository.
2. Open the `Product_Explorer_Mini_Project` folder in VS Code.
3. Open `index.html` with the **Live Server** extension.
4. The website will open in your browser. An internet connection is needed to load products.

You can also run it without Live Server. Open a terminal inside `Product_Explorer_Mini_Project` and enter:

```bash
python -m http.server 8000
```

Then visit `http://localhost:8000` in your browser.

## Project files

| File | Purpose |
| --- | --- |
| `index.html` | Page structure and content |
| `style.css` | Layout, colours and responsive styling |
| `app.js` | API requests, search, filters, favourites and browser storage |

## How it works

The app uses `fetch()` with `async/await` to get product data. It checks the response before reading the JSON and shows a message if something goes wrong.

Product data, search settings and favourites are kept in a JavaScript `state` object. The `render()` function updates the page whenever that data changes. Saved favourites are converted to JSON and stored in `localStorage`, so they can be loaded again when the page is refreshed.

## Testing

I tested the product loading, search, category filters, sorting, add/remove favourites, browser refresh, API error message and mobile layout.

## Notes

- Products and prices are provided by the Fake Store API for demonstration purposes.
- Favourites are stored in the browser you use. They are not linked to an account.
- This project is for learning purposes and does not support actual purchases.