import { AuthMailPublishable } from '../publishable/AuthMailPublishable';
import { copyFileSync, createWriteStream, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { download } from "./download";
import { InertiaConfigModifier } from '../modifier/InertiaConfigModifier';
import { InertiaPublishable } from '../publishable/InertiaPublishable';
import { InertiaResolverModifier } from '../modifier/InertiaResolverModifier';
import { join } from 'path';
import { MailPublishable } from '../publishable/MailPublishable';
import { PrettyErrorsModifier } from '../modifier/PrettyErrorsModifier';
import { ReactHook } from '../hooks/ReactHook';
import { SPAPublishable } from '../publishable/SPAPublishable';
import { spawnSync } from 'child_process';
import { tmpdir } from 'os';
import { updateLine } from './updateLine';
import { VueHook } from '../hooks/VueHook';
import { WebPublishable } from '../publishable/WebPublishable';
import New from '../commands/new';
const unzipper = require('unzipper');

export class Scaffold {
	/**
	 * Scaffolding state.
	 *
	 * @var {boolean} success
	 */
	private success: boolean = false;

	/**
	 * Scaffolding busy.
	 *
	 * @var {boolean} busy
	 */
	private busy: boolean = false;

	/**
	 * Formidable skeleton.
	 *
	 * @var {string} url
	 */
	protected url: string = 'https://github.com/formidablejs/formidablejs/archive/refs/heads/main.zip';

	/**
	 * Formidable skeleton destination.
	 *
	 * @var {string} skeleton
	 */
	protected skeleton: string = join(tmpdir(), 'formidablejs-master.zip');

	/**
	 * Scaffold application.
	 *
	 * @param {string} appName application name
	 * @param {string} output Output directory
	 * @param {New} command
	 * @returns {void}
	 */
	constructor(protected appName: string, protected output: string, protected command: New) {
		//
	}

	/**
	 * Check if scaffold was successful.
	 *
	 * @returns {boolean}
	 */
	public get isSuccessful(): Boolean {
		return this.success;
	}

	/**
	 * Check if application is still scaffolding.
	 *
	 * @returns {boolean}
	 */
	public get isBusy(): Boolean {
		return this.busy;
	}

	/**
	 * Make application.
	 *
	 * @returns {void}
	 */
	public make() {
		this.busy = true;

		download(this.url, this.skeleton)
			.then(async (response) => {
				this.busy = false;

				if (response !== true) return this.success = false;

				const directory = await unzipper.Open.file(this.skeleton);

				Object.values(directory.files).forEach((entry: any) => {
					const dir = entry.path.split('/');

					dir.shift();

					const entryPath = join(this.output, dir.join('/'));

					if (entry.type === 'Directory') {
						mkdirSync(entryPath, { recursive: true });
					} else {
						if (entry.path.split('/').pop() !== 'package-lock.json') {
							entry.stream()
								.pipe(createWriteStream(entryPath))
								.on('error', (error: any) => {
									this.command.error('Could not create Formidablejs application');

									this.command.exit;
								});
						}
					}
				});

				this.success = true;
			})
	}

	/**
	 * Run installer.
	 *
	 * @returns {Scaffold}
	 */
	public install() {
		this.command.log(`\n⚡ Installation will begin shortly. This might take a while ☕\n`);

		/** create env. */
		this.createEnv();

		/** collection dependencies. */
		const deps = this.getDependencies();

		/** install dependencies. */
		spawnSync(
			this.command.onboarding.manager ?? 'npm', [deps.length > 0 && this.command.onboarding.manager === 'yarn' ? 'add' : 'install', ...deps, '--legacy-peer-deps'],
			{ cwd: this.output, stdio: 'inherit' }
		);

		/** copy inertia files to application. */
		if (
			this.command.onboarding.type === 'full-stack'
			&& this.command.onboarding.stack
		) {
			if (this.command.onboarding.stack.toLowerCase() === 'react') {
				ReactHook.make(this.output);
			}

			if (this.command.onboarding.stack.toLowerCase() === 'vue') {
				VueHook.make(this.output);
			}
		}

		return this;
	}

	/**
	 * Create env variable file.
	 *
	 * @returns {void}
	 */
	private createEnv() {
		copyFileSync(join(this.output, '.env.example'), join(this.output, '.env'));
	}

	/**
	 * Get dependencies to install.
	 *
	 * @return {string[]}
	 */
	private getDependencies(): string[] {
		let deps: string[] = [];

		if (this.command.onboarding.type === 'full-stack') {
			deps.push('@formidablejs/pretty-errors');

			if (this.command.onboarding.stack?.toLowerCase() === 'imba' && this.command.onboarding.scaffolding === 'spa') {
				deps.push('@formidablejs/view');
				deps.push('axios');
			}

			if (this.command.onboarding.stack && ['react', 'vue'].includes(this.command.onboarding.stack)) {
				deps.push('@formidablejs/inertia');
			}
		}

		if (this.command.onboarding.database && this.command.onboarding.database !== 'skip') {
			deps.push(this.command.onboarding.database);
		}

		return deps;
	}

	/**
	 * Publish dependencies.
	 *
	 * @returns {Scaffold}
	 */
	public publish(): Scaffold {
		this.command.log(' ');

		AuthMailPublishable.make(this.output);
		MailPublishable.make(this.output);

		if (this.command.onboarding.type === 'full-stack') {
			if (this.command.onboarding.scaffolding === 'blank') {
				WebPublishable.make(this.output);
			} else if (this.command.onboarding.scaffolding === 'spa') {
				SPAPublishable.make(this.output);
			} else if (this.command.onboarding.stack && ['react', 'vue'].includes(this.command.onboarding.stack)) {
				WebPublishable.make(this.output);
				InertiaPublishable.make(this.output);
			}
		}

		return this;
	}

	/**
	 * Modify application.
	 *
	 * @returns {Scaffold}
	 */
	public modify(): Scaffold {
		if (this.command.onboarding.type === 'full-stack') {
			PrettyErrorsModifier.make(this.output);

			if (['react', 'vue'].includes(this.command.onboarding.stack ?? '')) {
				InertiaResolverModifier.make(this.output);
				InertiaConfigModifier.make(this.output);
			}
		}

		return this;
	}

	/**
	 * Generate encryption key.
	 *
	 * @returns {Scaffold}
	 */
	public generateKey(): Scaffold {
		this.command.log(' ');

		spawnSync('./node_modules/.bin/craftsman', ['key'], {
			cwd: this.output, stdio: 'inherit'
		});

		return this;
	}

	/**
	 * Set package name.
	 *
	 * @returns {Scaffold}
	 */
	public setPackageName(): Scaffold {
		const packageName = join(this.output, 'package.json');

		const packageObject: any = JSON.parse(readFileSync(packageName).toString());

		packageObject.name = this.appName.replace(new RegExp(' ', 'g'), '-');

		writeFileSync(packageName, JSON.stringify(packageObject, null, 2));

		return this;
	}

	/**
	 * Comment out client url.
	 *
	 * @returns {Scaffold}
	 */
	public commentOutClientUrl(): Scaffold {
		if (this.command.onboarding.type !== 'full-stack') return this;

		updateLine(join(this.output, '.env'), (line: string) => {
			if (line.trim() === 'CLIENT_URL=http://localhost:8000') {
				line = '# CLIENT_URL=http://localhost:8000';
			}

			return line;
		});

		return this;
	}

	/**
	 * Set session driver.
	 *
	 * @returns {Scaffold}
	 */
	public setSession(): Scaffold {
		if (this.command.onboarding.type !== 'full-stack') return this;

		updateLine(join(this.output, 'config', 'session.imba'), (line: string) => {
			if (line.trim() == "driver: 'memory'") {
				line = "  driver: 'file'";
			}

			return line;
		});

		updateLine(join(this.output, 'config', 'session.imba'), (line: string) => {
			if (line.trim() == "same_site: helpers.env 'SESSION_SAME_SITE', 'none'") {
				line = "	same_site: helpers.env 'SESSION_SAME_SITE', 'lax'";
			}

			return line;
		});

		return this;
	}

	/**
	 * Set application database.
	 *
	 * @returns {Scaffold}
	 */
	public setDatabase(): Scaffold {
		if (this.command.onboarding.database === 'skip') return this;

		let connection: string = '';

		switch (this.command.onboarding.database) {
			case 'mysql':
				connection = 'mysql';
				break;

			case 'pg':
				connection = 'pgsql';
				break;

			case 'sqlite3':
				connection = 'sqlite';
				break;

			case 'tedious':
				connection = 'mssql';
				break;

			case 'oracledb':
				connection = 'oracle';
				break;
		}

		updateLine(join(this.output, '.env'), (line: string) => {
			if (line.startsWith('DB_CONNECTION')) line = `DB_CONNECTION=${connection}`;

			return line;
		});

		if (connection === 'sqlite') {
			updateLine(join(this.output, 'config', 'database.imba'), (line: string) => {
				if (line.trim() == 'useNullAsDefault: null') {
					line = '	useNullAsDefault: true';
				}

				return line;
			});
		}

		return this;
	}

	/**
	 * Cache application.
	 *
	 * @returns {Scaffold}
	 */
	public cache(): Scaffold {
		spawnSync('./node_modules/.bin/craftsman', ['cache', '--debug'], {
			cwd: this.output, stdio: 'inherit'
		})

		return this;
	}

	/**
	 * Initialize git..
	 *
	 * @returns {Scaffold}
	 */
	public git(): Scaffold {
		spawnSync('git', ['init',], {
			cwd: this.output, stdio: 'inherit'
		});

		return this;
	}
}
