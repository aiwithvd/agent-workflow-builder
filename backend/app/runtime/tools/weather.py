"""Weather tool for agents using OpenWeatherMap API."""

import httpx
from langchain_core.tools import Tool

from app.config import settings


async def get_weather(city: str) -> str:
    """Get current weather for a city.

    Args:
        city: City name (e.g., "London", "New York")

    Returns:
        Weather information or error message
    """
    if not settings.openweathermap_api_key:
        return "Error: OpenWeatherMap API key not configured"

    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(
                "https://api.openweathermap.org/data/2.5/weather",
                params={
                    "q": city,
                    "appid": settings.openweathermap_api_key,
                    "units": "metric",
                },
            )
            response.raise_for_status()

            data = response.json()

            return f"""
Weather in {data['name']}, {data['sys']['country']}:
Temperature: {data['main']['temp']}°C
Feels like: {data['main']['feels_like']}°C
Condition: {data['weather'][0]['description'].title()}
Humidity: {data['main']['humidity']}%
Wind Speed: {data['wind']['speed']} m/s
"""

    except httpx.HTTPError as e:
        return f"Error fetching weather: {str(e)}"


def get_weather_sync(city: str) -> str:
    """Synchronous wrapper for weather lookup (for tool compatibility).

    Args:
        city: City name

    Returns:
        Weather information
    """
    import asyncio

    try:
        loop = asyncio.get_event_loop()
    except RuntimeError:
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)

    return loop.run_until_complete(get_weather(city))


def create_weather_tool() -> Tool:
    """Create a weather lookup tool for agents.

    Returns:
        Configured weather tool
    """
    return Tool(
        name="weather",
        description="Get current weather information for a city. Input should be the city name (e.g., 'London', 'Mumbai').",
        func=get_weather_sync,
    )
