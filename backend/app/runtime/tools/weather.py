"""Weather tool for agents using OpenWeatherMap API."""

import httpx
from langchain_core.tools import Tool

from app.config import settings


def get_weather_sync(city: str) -> str:
    """Get current weather for a city (synchronous, safe for tool use).

    Args:
        city: City name (e.g., "London", "New York")

    Returns:
        Weather information or error message
    """
    if not settings.openweathermap_api_key:
        return "Error: OpenWeatherMap API key not configured"

    try:
        with httpx.Client(timeout=10.0) as client:
            response = client.get(
                "https://api.openweathermap.org/data/2.5/weather",
                params={
                    "q": city,
                    "appid": settings.openweathermap_api_key,
                    "units": "metric",
                },
            )
            response.raise_for_status()
            data = response.json()

            return (
                f"Weather in {data['name']}, {data['sys']['country']}: "
                f"{data['main']['temp']}°C, feels like {data['main']['feels_like']}°C, "
                f"{data['weather'][0]['description'].title()}, "
                f"humidity {data['main']['humidity']}%, "
                f"wind {data['wind']['speed']} m/s"
            )

    except httpx.HTTPError as e:
        return f"Error fetching weather: {str(e)}"
    except (KeyError, ValueError) as e:
        return f"Error parsing weather response: {str(e)}"


def create_weather_tool() -> Tool:
    """Create a weather lookup tool for agents."""
    return Tool(
        name="weather",
        description="Get current weather information for a city. Input should be the city name (e.g., 'London', 'Mumbai').",
        func=get_weather_sync,
    )
