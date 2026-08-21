# ClearLag++

Welcome to ClearLag++! This is a comprehensive plugin designed to manage your server's performance by controlling entities, optimizing game mechanics, and providing detailed performance metrics.

## Configuration
The main configuration file is **config.yml**, located in this folder. You can customize nearly every feature of the plugin here, from auto-clear intervals to mob stacking rules and optimization settings. After making changes, use `/clearlag reload` to apply them.

## Key Features
* **Auto-Clearing:** Periodically removes dropped items and other entities to reduce lag.
* **Mob Limiting:** Controls mob spawn rates and stacks similar mobs into single entities.
* **Optimizations:** Includes modules for Redstone, Hoppers, AI, Leaf Decay, and more.
* **Lag Detection:** Identifies and throttles fast redstone clocks and mass-falling-block physics.
* **Performance Metrics:** Provides commands to check TPS, RAM, CPU, and entity counts.
* **Chunk Management:** Finds and unloads laggy chunks automatically or manually.
* **Discord Integration:** Sends reports and alerts to a Discord channel.
* **Item Merge Optimization:** Actively merges nearby dropped items to reduce entity counts.

## Main Commands
* `/clearlag`: Shows the main help menu.
* `/clearlag clear <items/entity/all>`: Manually clears entities.
* `/clearlag killmobs <evil/good/all>`: Manually kills specific mob types.
* `/clearlag reload`: Reloads the configuration file.
* `/clearlag nextclear`: Shows the time until the next automatic clear.
* `/clearlag specs`: Displays a summary of server performance (TPS, RAM).
* `/clearlag chunkfinder <count>`: Finds the top laggiest chunks by entity count.
* `/clearlag nuke [radius]`: Radically removes all non-player entities in a radius.

## Permissions
Permissions are straightforward and follow the command structure. By default, most commands require OP.
* `clearlag.all`: Grants access to all plugin commands.
* `clearlag.reload`: Allows reloading the plugin.
* `clearlag.clear`: Allows using the clear command.
* `clearlag.nuke`: Allows using the nuke command.
* ...and so on for each subcommand.

## Placeholders (for PlaceholderAPI)
If you have PlaceholderAPI installed, you can use these placeholders:
* `%clearlag_nextclear%`: Time until the next clear (e.g., 4m 30s).
* `%clearlag_nextclear_seconds%`: Time until the next clear in total seconds.
* `%clearlag_ram%`: Server RAM usage.
* `%clearlag_entity_total%`: Total entities on the server.
* `%clearlag_mobs_total%`: Total mobs on the server.
* `%clearlag_dropped_items_total%`: Total dropped items on the server.
* `%clearlag_loaded_chunks%`: Total loaded chunks.
* `for more, visit the Modrinth page.`

## Support
For detailed configuration guides, updates, and support, please visit the official Modrinth page: https://modrinth.com/plugin/clearlag++
## Used Plugins
LuckPerms (for advanced permission management) PlaceholderAPI (for placeholders) InstantLeafDecay (Code from https://modrinth.com/plugin/instaleafdecay by Mobilestars with an special License)
